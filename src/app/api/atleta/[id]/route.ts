import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/is-admin'

function ultimaDomenicaOttobre(anno: number): Date {
  const d = new Date(anno, 9, 31)
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1)
  return d
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atletaIdCorrente = user?.user_metadata?.atleta_id ?? null
  const isMe = atletaIdCorrente === id
  const canSeeEvents = isMe || isAdmin(user)

  const anno = new Date().getFullYear()
  const inizioAnno = `${anno}-01-01`

  // 1. Dati atleta
  const { data: atleta } = await supabase
    .from('atleti')
    .select('id, nome_cognome, categoria_corrente, numero_tessera')
    .eq('id', id)
    .single()

  if (!atleta) return Response.json({ error: 'Atleta non trovato' }, { status: 404 })

  // 2. Registrazioni dell'atleta con percorso ed evento
  const { data: regs } = await supabase
    .from('registrazioni')
    .select(`
      id,
      completato,
      km_effettivi,
      punti,
      percorso_id,
      percorsi!inner (
        id,
        nome_percorso,
        km,
        dislivello_m,
        tipologia,
        evento_id,
        eventi!inner (
          id,
          nome,
          data_evento,
          luogo,
          url
        )
      )
    `)
    .eq('atleta_id', id)
    .order('created_at', { ascending: false })

  const registrazioni = regs ?? []

  // 3. Punti anno corrente
  const puntiTotali = registrazioni.reduce((acc, r: any) => {
    const dataEvento = r.percorsi?.eventi?.data_evento
    if (dataEvento && dataEvento >= inizioAnno) return acc + (r.punti ?? 0)
    return acc
  }, 0)

  // 4. Posizione in classifica (solo atleti attivi stessa categoria)
  const { data: altraRoba } = await supabase
    .from('registrazioni')
    .select(`punti, atleta_id, percorsi!inner(eventi!inner(data_evento))`)
    .neq('atleta_id', id)

  // Raggruppa per atleta_id e somma punti anno corrente
  const puntiPerAtleta: Record<string, number> = {}
  for (const r of altraRoba ?? []) {
    const dataEvento = (r.percorsi as any)?.eventi?.data_evento
    if (!dataEvento || dataEvento < inizioAnno) continue
    const aid = r.atleta_id as string
    puntiPerAtleta[aid] = (puntiPerAtleta[aid] ?? 0) + (r.punti ?? 0)
  }

  // Conta quanti atleti della stessa categoria hanno più punti
  const { data: atletiCategoria } = await supabase
    .from('atleti')
    .select('id')
    .eq('categoria_corrente', atleta.categoria_corrente)
    .eq('attivo', true)
    .neq('id', id)

  let posizione = 1
  for (const a of atletiCategoria ?? []) {
    if ((puntiPerAtleta[a.id] ?? 0) > puntiTotali) posizione++
  }

  const sogliaFinisher = atleta.categoria_corrente === 'AMATORI' ? 9000 : 4000
  const finisher = puntiTotali >= sogliaFinisher
  const progressione = Math.min(100, Math.round((puntiTotali / sogliaFinisher) * 100))

  // 5. Storico eventi (solo per atleta o admin)
  const eventi = canSeeEvents
    ? registrazioni
        .filter((r: any) => r.percorsi?.eventi?.data_evento)
        .map((r: any) => ({
          data: r.percorsi.eventi.data_evento,
          nome: r.percorsi.eventi.nome,
          luogo: r.percorsi.eventi.luogo ?? '',
          url: r.percorsi.eventi.url ?? null,
          percorso: r.percorsi.nome_percorso,
          tipologia: r.percorsi.tipologia ?? '',
          km: r.percorsi.km,
          dislivello_m: r.percorsi.dislivello_m,
          completato: r.completato,
          km_effettivi: r.km_effettivi,
          punti: r.punti ?? 0,
        }))
    : null

  return Response.json({
    atleta: {
      id: atleta.id,
      nome: atleta.nome_cognome,
      categoria: atleta.categoria_corrente,
      numero_tessera: atleta.numero_tessera ?? null,
    },
    puntiTotali,
    posizione,
    finisher,
    progressione,
    sogliaFinisher,
    isMe,
    canSeeEvents,
    eventi,
  })
}

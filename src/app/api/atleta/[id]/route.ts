import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/is-admin'

function ultimaDomenicaOttobre(anno: number): Date {
  const d = new Date(anno, 9, 31)
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1)
  return d
}

// GET /api/atleta/[id]
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atletaIdCorrente = user?.user_metadata?.atleta_id ?? null
  const isMe = atletaIdCorrente === params.id
  const canSeeEvents = isMe || isAdmin(user)

  const anno = new Date().getFullYear()
  const inizioAnno = `${anno}-01-01`

  const { data: atleta } = await supabase
    .from('atleti')
    .select('id, nome_cognome, categoria_corrente, numero_tessera')
    .eq('id', params.id)
    .single()

  if (!atleta) return Response.json({ error: 'Atleta non trovato' }, { status: 404 })

  const { data: regs } = await supabase
    .from('registrazioni')
    .select(`
      punti,
      completato,
      km_effettivi,
      percorsi (
        nome_percorso,
        km,
        dislivello_m,
        tipologia,
        eventi (
          nome,
          data_evento,
          luogo,
          url
        )
      )
    `)
    .eq('atleta_id', params.id)
    .order('created_at', { ascending: false })

  const puntiTotali = (regs ?? []).reduce((acc, r) => {
    const dataEvento = (r.percorsi as any)?.eventi?.data_evento
    if (dataEvento && dataEvento >= inizioAnno) return acc + (r.punti ?? 0)
    return acc
  }, 0)

  // Posizione in classifica
  const { data: tuttiAtleti } = await supabase
    .from('atleti')
    .select(`id, registrazioni(punti, percorsi(eventi(data_evento)))`)
    .eq('categoria_corrente', atleta.categoria_corrente)

  let posizione = 1
  for (const a of tuttiAtleti ?? []) {
    if (a.id === params.id) continue
    const pts = (a.registrazioni ?? []).reduce((acc: number, r: any) => {
      const d = r.percorsi?.eventi?.data_evento
      return d && d >= inizioAnno ? acc + (r.punti ?? 0) : acc
    }, 0)
    if (pts > puntiTotali) posizione++
  }

  const sogliaFinisher = atleta.categoria_corrente === 'AMATORI' ? 9000 : 4000
  const finisher = puntiTotali >= sogliaFinisher
  const progressione = Math.min(100, Math.round((puntiTotali / sogliaFinisher) * 100))

  const eventi = canSeeEvents
    ? (regs ?? [])
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

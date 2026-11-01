import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/is-admin'
import { ultimaDomenicaOttobre } from '@/lib/date-utils'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atletaIdCorrente = user?.user_metadata?.atleta_id ?? null
  const isMe = atletaIdCorrente === id
  const canSeeEvents = isMe || isAdmin(user)

  const annoParam = req.nextUrl.searchParams.get('anno')
  const { data: stagioni } = await supabase
    .from('stagioni')
    .select('id, anno, attiva')
    .order('anno', { ascending: false })

  const stagioneSelezionata = annoParam
    ? stagioni?.find((s) => String(s.anno) === annoParam)
    : stagioni?.find((s) => s.attiva) ?? stagioni?.[0]

  const anno = stagioneSelezionata?.anno ?? 2027
  const stagioneId = stagioneSelezionata?.id ?? 2
  const scadenza = ultimaDomenicaOttobre(anno)
  const scadenzaStr = scadenza.toISOString().split('T')[0]

  // 1. Dati atleta
  const { data: atletaList } = await supabase
    .from('atleti')
    .select('id, nome_cognome, categoria_corrente, numero_tessera, data_nascita')
    .filter('id', 'eq', id)
    .limit(1)

  const atleta = atletaList?.[0] ?? null
  if (!atleta) return Response.json({ error: 'Atleta non trovato' }, { status: 404 })

  // 2. Registrazioni dell'atleta nella stagione selezionata
  const { data: regs } = await supabase
    .from('registrazioni')
    .select('id, completato, km_effettivi, punti, percorso_id, stagione_id')
    .eq('atleta_id', id)
    .eq('stagione_id', stagioneId)
    .order('created_at', { ascending: false })

  // 3. Punti stagione selezionata
  const puntiTotali = (regs ?? []).reduce((acc, r: any) => acc + (r.punti ?? 0), 0)

  // 4. Posizione nella categoria per la stagione selezionata
  const { data: atletiCategoria } = await supabase
    .from('atleti')
    .select('id')
    .eq('categoria_corrente', atleta.categoria_corrente)
    .eq('attivo', true)
    .neq('id', id)

  const altriIds = (atletiCategoria ?? []).map((a: any) => a.id)

  const { data: regsAltri } = altriIds.length > 0
    ? await supabase
        .from('registrazioni')
        .select('atleta_id, punti')
        .in('atleta_id', altriIds)
        .eq('stagione_id', stagioneId)
    : { data: [] }

  const puntiAltri: Record<string, number> = {}
  for (const r of regsAltri ?? []) {
    const aid = r.atleta_id as string
    puntiAltri[aid] = (puntiAltri[aid] ?? 0) + (r.punti ?? 0)
  }

  const posizione = 1 + Object.values(puntiAltri).filter((p) => p > puntiTotali).length

  const sogliaFinisher = atleta.categoria_corrente === 'AMATORI' ? 9000 : 4000
  const finisher = puntiTotali >= sogliaFinisher
  const progressione = Math.min(100, Math.round((puntiTotali / sogliaFinisher) * 100))

  // 5. Dettagli percorsi ed eventi per lo storico (solo se serve)
  const percorsoIds = (regs ?? []).map((r: any) => r.percorso_id)
  const { data: percorsiAnno } = canSeeEvents && percorsoIds.length > 0
    ? await supabase.from('percorsi').select('id, nome_percorso, km, dislivello_m, evento_id').in('id', percorsoIds)
    : { data: [] }

  const percorsoMap = Object.fromEntries((percorsiAnno ?? []).map((p: any) => [p.id, p]))
  const eventoIds = [...new Set((percorsiAnno ?? []).map((p: any) => p.evento_id))]
  const eventoMap: Record<string, any> = {}

  if (canSeeEvents && eventoIds.length > 0) {
    const { data: evDettagli } = await supabase
      .from('eventi')
      .select('*')
      .in('id', eventoIds)
    for (const e of evDettagli ?? []) eventoMap[e.id] = e
  }

  // 8. Storico eventi (solo atleta o admin)
  const storicoEventi = canSeeEvents
    ? (regs ?? [])
        .map((r: any) => {
          const p = percorsoMap[r.percorso_id]
          const e = p ? eventoMap[p.evento_id] : null
          if (!e) return null
          return {
            data: e.data_evento,
            nome: e.nome,
            luogo: e.luogo ?? '',
            url: e.url ?? null,
            percorso: p.nome_percorso ?? '',
            tipologia: '',
            km: p.km ?? 0,
            dislivello_m: p.dislivello_m ?? 0,
            completato: r.completato,
            km_effettivi: r.km_effettivi,
            punti: r.punti ?? 0,
          }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.data.localeCompare(a.data))
    : null

  return Response.json({
    atleta: {
      id: atleta.id,
      nome: atleta.nome_cognome,
      categoria: atleta.categoria_corrente,
      numero_tessera: atleta.numero_tessera ?? null,
      data_nascita: atleta.data_nascita ?? null,
    },
    puntiTotali,
    posizione,
    finisher,
    progressione,
    sogliaFinisher,
    isMe,
    canSeeEvents,
    eventi: storicoEventi,
    scadenza: scadenzaStr,
  })
}

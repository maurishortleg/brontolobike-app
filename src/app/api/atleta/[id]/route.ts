import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/is-admin'

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
  const { data: atleta, error: errAtleta } = await supabase
    .from('atleti')
    .select('id, nome_cognome, categoria_corrente, numero_tessera')
    .eq('id', id)
    .single()

  if (errAtleta || !atleta) return Response.json({ error: 'Atleta non trovato' }, { status: 404 })

  // 2. Registrazioni dell'atleta (query semplice senza join annidati)
  const { data: regs } = await supabase
    .from('registrazioni')
    .select('id, completato, km_effettivi, punti, percorso_id')
    .eq('atleta_id', id)

  const percorsoIds = (regs ?? []).map((r: any) => r.percorso_id)

  // 3. Percorsi
  const { data: percorsi } = percorsoIds.length > 0
    ? await supabase.from('percorsi').select('id, nome_percorso, km, dislivello_m, tipologia, evento_id').in('id', percorsoIds)
    : { data: [] }

  const eventoIds = [...new Set((percorsi ?? []).map((p: any) => p.evento_id))]

  // 4. Eventi
  const { data: eventi_db } = eventoIds.length > 0
    ? await supabase.from('eventi').select('id, nome, data_evento, luogo, url').in('id', eventoIds)
    : { data: [] }

  // Mappe per lookup rapido
  const percorsoMap = Object.fromEntries((percorsi ?? []).map((p: any) => [p.id, p]))
  const eventoMap = Object.fromEntries((eventi_db ?? []).map((e: any) => [e.id, e]))

  // 5. Componi registrazioni complete
  const regsComplete = (regs ?? []).map((r: any) => {
    const p = percorsoMap[r.percorso_id]
    const e = p ? eventoMap[p.evento_id] : null
    return { ...r, percorso: p, evento: e }
  })

  // 6. Punti anno corrente
  const puntiTotali = regsComplete.reduce((acc, r) => {
    if (r.evento?.data_evento >= inizioAnno) return acc + (r.punti ?? 0)
    return acc
  }, 0)

  // 7. Posizione in classifica
  const { data: atletiCategoria } = await supabase
    .from('atleti')
    .select('id')
    .eq('categoria_corrente', atleta.categoria_corrente)
    .eq('attivo', true)
    .neq('id', id)

  let posizione = 1
  for (const a of atletiCategoria ?? []) {
    const { data: regsAltro } = await supabase
      .from('registrazioni')
      .select('punti, percorso_id')
      .eq('atleta_id', a.id)

    const pIds = (regsAltro ?? []).map((r: any) => r.percorso_id)
    if (pIds.length === 0) continue

    const { data: pAltro } = await supabase
      .from('percorsi')
      .select('id, evento_id')
      .in('id', pIds)

    const eIds = [...new Set((pAltro ?? []).map((p: any) => p.evento_id))]
    if (eIds.length === 0) continue

    const { data: eAltro } = await supabase
      .from('eventi')
      .select('id, data_evento')
      .in('id', eIds)
      .gte('data_evento', inizioAnno)

    const eIdSet = new Set((eAltro ?? []).map((e: any) => e.id))
    const pIdSet = new Set((pAltro ?? []).filter((p: any) => eIdSet.has(p.evento_id)).map((p: any) => p.id))

    const puntiAltro = (regsAltro ?? []).reduce((acc: number, r: any) => {
      return pIdSet.has(r.percorso_id) ? acc + (r.punti ?? 0) : acc
    }, 0)

    if (puntiAltro > puntiTotali) posizione++
  }

  const sogliaFinisher = atleta.categoria_corrente === 'AMATORI' ? 9000 : 4000
  const finisher = puntiTotali >= sogliaFinisher
  const progressione = Math.min(100, Math.round((puntiTotali / sogliaFinisher) * 100))

  // 8. Storico eventi
  const storicoEventi = canSeeEvents
    ? regsComplete
        .filter((r) => r.evento?.data_evento)
        .sort((a, b) => b.evento.data_evento.localeCompare(a.evento.data_evento))
        .map((r) => ({
          data: r.evento.data_evento,
          nome: r.evento.nome,
          luogo: r.evento.luogo ?? '',
          url: r.evento.url ?? null,
          percorso: r.percorso?.nome_percorso ?? '',
          tipologia: r.percorso?.tipologia ?? '',
          km: r.percorso?.km ?? 0,
          dislivello_m: r.percorso?.dislivello_m ?? 0,
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
    eventi: storicoEventi,
  })
}

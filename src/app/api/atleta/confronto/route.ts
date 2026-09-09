import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/atleta/confronto?ids=id1,id2,id3&anno=2026
// Restituisce punti mensili e trimestrali per ogni atleta richiesto
export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids') ?? ''
  const anno = parseInt(req.nextUrl.searchParams.get('anno') ?? String(new Date().getFullYear()))

  const ids = idsParam.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 3)
  if (ids.length === 0) return Response.json({ error: 'ids mancanti' }, { status: 400 })

  const supabase = await createSupabaseServerClient()

  const inizioAnno = `${anno}-01-01`
  const fineAnno = `${anno}-12-31`

  // Carica eventi dell'anno con data
  const { data: eventiAnno } = await supabase
    .from('eventi')
    .select('id, data_evento')
    .gte('data_evento', inizioAnno)
    .lte('data_evento', fineAnno)

  const eventoDateMap: Record<string, string> = {}
  for (const e of eventiAnno ?? []) eventoDateMap[e.id] = e.data_evento

  // Carica percorsi collegati a questi eventi
  const eventoIds = Object.keys(eventoDateMap)
  if (eventoIds.length === 0) {
    return Response.json({ atleti: ids.map((id) => ({ id, nome: id, mensile: {}, trimestrale: {} })) })
  }

  const { data: percorsiAnno } = await supabase
    .from('percorsi')
    .select('id, evento_id')
    .in('evento_id', eventoIds)

  const percorsoEventoMap: Record<string, string> = {}
  for (const p of percorsiAnno ?? []) percorsoEventoMap[p.id] = p.evento_id

  // Carica nomi atleti
  const { data: atletiData } = await supabase
    .from('atleti')
    .select('id, nome_cognome')
    .in('id', ids)

  const nomeMap: Record<string, string> = {}
  for (const a of atletiData ?? []) nomeMap[a.id] = a.nome_cognome

  // Carica registrazioni per tutti gli atleti richiesti
  const { data: regs } = await supabase
    .from('registrazioni')
    .select('atleta_id, punti, percorso_id')
    .in('atleta_id', ids)

  // Aggrega punti per atleta → mese e trimestre
  const mensile: Record<string, Record<string, number>> = {}
  const trimestrale: Record<string, Record<string, number>> = {}

  for (const id of ids) {
    mensile[id] = {}
    trimestrale[id] = {}
  }

  for (const r of regs ?? []) {
    const aid = r.atleta_id as string
    const pid = String(r.percorso_id)
    const eventoId = percorsoEventoMap[pid]
    if (!eventoId) continue
    const data = eventoDateMap[eventoId]
    if (!data) continue

    const mese = data.slice(0, 7) // "2026-03"
    const meseNum = parseInt(data.slice(5, 7))
    const q = `Q${Math.ceil(meseNum / 3)}`

    mensile[aid][mese] = (mensile[aid][mese] ?? 0) + (r.punti ?? 0)
    trimestrale[aid][q] = (trimestrale[aid][q] ?? 0) + (r.punti ?? 0)
  }

  const atleti = ids.map((id) => ({
    id,
    nome: nomeMap[id] ?? id,
    mensile: mensile[id] ?? {},
    trimestrale: trimestrale[id] ?? {},
  }))

  return Response.json({ atleti, anno })
}

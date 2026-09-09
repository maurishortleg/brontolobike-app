import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { TIPOLOGIE_LIBERE } from '@/lib/classifica-tipologia'

// GET /api/eventi-per-data?data=YYYY-MM-DD
// Restituisce gli eventi che coprono quella data (inclusi multi-giorno).
// Esclusi gli eventi senza data fissa (Brevetti Permanenti, Percorso con Credenziale):
// questi non appaiono mai in una data specifica del calendario.
export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get('data')
  if (!data) return Response.json({ risultati: [], liberi: [] })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // 1. Eventi con data fissa che coprono il giorno selezionato
  const { data: risultatiRaw } = await supabase
    .from('eventi')
    .select('id, nome, data_evento, data_fine, tipologia, luogo, url, immagine_url')
    .eq('attivo', true)
    .not('tipologia', 'in', `(${TIPOLOGIE_LIBERE.map(t => `"${t}"`).join(',')})`)
    .lte('data_evento', data)
    .or(`data_fine.gte.${data},and(data_fine.is.null,data_evento.eq.${data})`)
    .order('data_evento', { ascending: true })

  // 2. Eventi liberi (sempre disponibili) – restituiti separatamente
  const { data: liberiRaw } = await supabase
    .from('eventi')
    .select('id, nome, tipologia, url, immagine_url, luogo')
    .eq('attivo', true)
    .in('tipologia', TIPOLOGIE_LIBERE)
    .order('nome', { ascending: true })

  // 3. Carica percorsi normalizzati per tutti gli eventi trovati
  const tuttiId = [
    ...(risultatiRaw ?? []).map(e => e.id),
    ...(liberiRaw ?? []).map(e => e.id),
  ]

  let percorsiMap: Record<string, Array<{ nome: string; km: number | null; dislivello: number | null; tipologia: string | null }>> = {}

  if (tuttiId.length > 0) {
    const { data: percorsiRows } = await supabase
      .from('percorsi')
      .select('id, evento_id, nome_percorso, km, dislivello_m, tipologia_id')
      .in('evento_id', tuttiId)

    const tipologiaIds = [...new Set((percorsiRows ?? []).map(p => p.tipologia_id).filter(Boolean))]
    const { data: tipologie } = tipologiaIds.length > 0
      ? await supabase.from('tipologie_evento').select('id, nome').in('id', tipologiaIds)
      : { data: [] }

    const tipologiaMap = Object.fromEntries((tipologie ?? []).map(t => [t.id, t.nome]))

    for (const p of percorsiRows ?? []) {
      const eid = String(p.evento_id)
      if (!percorsiMap[eid]) percorsiMap[eid] = []
      percorsiMap[eid].push({
        nome: p.nome_percorso ?? '',
        km: p.km ?? null,
        dislivello: p.dislivello_m ?? null,
        tipologia: p.tipologia_id ? tipologiaMap[p.tipologia_id] : null,
      })
    }
  }

  // 4. Formatta risposta in shape compatibile con RegistraClient
  const risultati = (risultatiRaw ?? []).map(ev => ({
    ...ev,
    data: ev.data_evento,
    percorsi: percorsiMap[String(ev.id)] ?? [],
  }))

  const liberi = (liberiRaw ?? []).map(ev => ({
    ...ev,
    percorsi: percorsiMap[String(ev.id)] ?? [],
  }))

  return Response.json({ risultati, liberi })
}

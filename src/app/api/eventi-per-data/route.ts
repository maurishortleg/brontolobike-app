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
  const { data: risultati } = await supabase
    .from('eventi_ricercati')
    .select('*')
    .eq('attivo', true)
    .not('tipologia', 'in', `(${TIPOLOGIE_LIBERE.map(t => `"${t}"`).join(',')})`)
    .lte('data', data)
    .or(`data_fine.gte.${data},and(data_fine.is.null,data.eq.${data})`)
    .order('data', { ascending: true })

  // 2. Eventi liberi (sempre disponibili) – restituiti separatamente
  const { data: liberi } = await supabase
    .from('eventi_ricercati')
    .select('id, nome, tipologia, url, percorsi, immagine_url, luogo')
    .eq('attivo', true)
    .in('tipologia', TIPOLOGIE_LIBERE)
    .order('nome', { ascending: true })

  return Response.json({ risultati: risultati ?? [], liberi: liberi ?? [] })
}

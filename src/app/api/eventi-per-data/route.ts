import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/eventi-per-data?data=YYYY-MM-DD
// Restituisce gli eventi che coprono quella data (inclusi multi-giorno)
export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get('data')
  if (!data) return Response.json({ risultati: [] })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Un evento copre la data se:
  // - data_inizio <= data selezionata
  // - E (data_fine >= data selezionata OPPURE data_fine è null e data_inizio = data selezionata)
  const { data: risultati } = await supabase
    .from('eventi_ricercati')
    .select('*')
    .eq('attivo', true)
    .lte('data', data)
    .or(`data_fine.gte.${data},and(data_fine.is.null,data.eq.${data})`)
    .order('data', { ascending: true })

  return Response.json({ risultati: risultati ?? [] })
}

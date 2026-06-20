import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/calendario-club?mese=YYYY-MM
// Restituisce i giorni del mese che hanno almeno una registrazione
export async function GET(req: NextRequest) {
  const mese = req.nextUrl.searchParams.get('mese')
  if (!mese) return Response.json({ giorni: [] })

  const inizioMese = `${mese}-01`
  const fineDate = new Date(mese + '-01')
  fineDate.setMonth(fineDate.getMonth() + 1)
  fineDate.setDate(0)
  const fineMese = fineDate.toISOString().split('T')[0]

  const supabase = await createSupabaseServerClient()

  const { data } = await supabase
    .from('eventi')
    .select('data_evento')
    .gte('data_evento', inizioMese)
    .lte('data_evento', fineMese)

  const giorni = [...new Set((data ?? []).map((e) => e.data_evento))]
  return Response.json({ giorni })
}

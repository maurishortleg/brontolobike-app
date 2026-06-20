import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/calendario-club?mese=YYYY-MM
// Restituisce i giorni del mese con almeno una registrazione dell'utente corrente
export async function GET(req: NextRequest) {
  const mese = req.nextUrl.searchParams.get('mese')
  if (!mese) return Response.json({ giorni: [] })

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atletaId = user?.user_metadata?.atleta_id
  if (!atletaId) return Response.json({ giorni: [] })

  const inizioMese = `${mese}-01`
  const fineDate = new Date(mese + '-01')
  fineDate.setMonth(fineDate.getMonth() + 1)
  fineDate.setDate(0)
  const fineMese = fineDate.toISOString().split('T')[0]

  const { data } = await supabase
    .from('registrazioni')
    .select('eventi(data_evento)')
    .eq('atleta_id', atletaId)
    .gte('eventi.data_evento', inizioMese)
    .lte('eventi.data_evento', fineMese)

  const giorni = [...new Set(
    (data ?? [])
      .map((r: any) => r.eventi?.data_evento)
      .filter(Boolean)
  )]
  return Response.json({ giorni })
}

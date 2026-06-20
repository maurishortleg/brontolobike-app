import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// GET /api/eventi-calendario?mese=YYYY-MM
// Restituisce i giorni del mese che hanno almeno un evento
export async function GET(req: NextRequest) {
  const mese = req.nextUrl.searchParams.get('mese')
  if (!mese) return Response.json({ giorni: [] })

  const inizioMese = `${mese}-01`
  const fineDate = new Date(mese + '-01')
  fineDate.setMonth(fineDate.getMonth() + 1)
  fineDate.setDate(0)
  const fineMese = fineDate.toISOString().split('T')[0]

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Prende tutti gli eventi che si sovrappongono al mese visualizzato
  const { data: eventi } = await supabase
    .from('eventi_ricercati')
    .select('data, data_fine')
    .eq('attivo', true)
    .lte('data', fineMese)
    .or(`data_fine.gte.${inizioMese},data.gte.${inizioMese}`)

  if (!eventi?.length) return Response.json({ giorni: [] })

  // Calcola tutti i giorni coperti nel mese
  const giorni = new Set<string>()
  for (const ev of eventi) {
    const inizio = new Date(ev.data)
    const fine = ev.data_fine ? new Date(ev.data_fine) : new Date(ev.data)
    const cur = new Date(inizio)
    while (cur <= fine) {
      const iso = cur.toISOString().split('T')[0]
      if (iso >= inizioMese && iso <= fineMese) giorni.add(iso)
      cur.setDate(cur.getDate() + 1)
    }
  }

  return Response.json({ giorni: Array.from(giorni) })
}

import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/calendario-club?mese=YYYY-MM
// Restituisce i giorni del mese con registrazioni + tipologia principale per i pallini colorati
export async function GET(req: NextRequest) {
  const mese = req.nextUrl.searchParams.get('mese')
  if (!mese) return Response.json({ giorni: [], tipologie: {} })

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atletaId = user?.user_metadata?.atleta_id
  if (!atletaId) return Response.json({ giorni: [], tipologie: {} })

  const inizioMese = `${mese}-01`
  const fineDate = new Date(mese + '-01')
  fineDate.setMonth(fineDate.getMonth() + 1)
  fineDate.setDate(0)
  const fineMese = fineDate.toISOString().split('T')[0]

  const { data } = await supabase
    .from('registrazioni')
    .select('percorsi(tipologia_id, tipologie_evento(nome), eventi(data_evento))')
    .eq('atleta_id', atletaId)
    .gte('percorsi.eventi.data_evento', inizioMese)
    .lte('percorsi.eventi.data_evento', fineMese)

  const tipologiePerGiorno: Record<string, string> = {}

  for (const r of data ?? []) {
    const p = (r as any).percorsi
    if (!p) continue
    const data_evento: string = p.eventi?.data_evento
    if (!data_evento) continue
    const tipologia: string = p.tipologie_evento?.nome ?? ''
    if (!tipologiePerGiorno[data_evento]) {
      tipologiePerGiorno[data_evento] = tipologia
    }
  }

  const giorni = Object.keys(tipologiePerGiorno)
  return Response.json({ giorni, tipologie: tipologiePerGiorno })
}

import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/calendario-club/giorno?data=YYYY-MM-DD
// Restituisce le registrazioni dell'utente corrente per il giorno selezionato
export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get('data')
  if (!data) return Response.json({ registrazioni: [] })

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atletaId = user?.user_metadata?.atleta_id
  if (!atletaId) return Response.json({ registrazioni: [] })

  const { data: regs } = await supabase
    .from('registrazioni')
    .select(`
      completato,
      km_effettivi,
      punti,
      percorsi (
        nome_percorso,
        km,
        dislivello_m,
        eventi (
          nome,
          data_evento
        )
      )
    `)
    .eq('atleta_id', atletaId)
    .eq('percorsi.eventi.data_evento', data)

  if (!regs?.length) return Response.json({ registrazioni: [] })

  const registrazioni = regs
    .filter((r: any) => r.percorsi?.eventi?.data_evento === data)
    .map((r: any) => ({
      evento: r.percorsi?.eventi?.nome ?? '',
      percorso: r.percorsi?.nome_percorso ?? '',
      km: r.percorsi?.km ?? 0,
      dislivello_m: r.percorsi?.dislivello_m ?? 0,
      completato: r.completato,
      km_effettivi: r.km_effettivi,
      punti: r.punti,
    }))

  return Response.json({ registrazioni })
}

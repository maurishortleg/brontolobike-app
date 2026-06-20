import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/calendario-club/giorno?data=YYYY-MM-DD
// Restituisce tutte le registrazioni del giorno selezionato
export async function GET(req: NextRequest) {
  const data = req.nextUrl.searchParams.get('data')
  if (!data) return Response.json({ registrazioni: [] })

  const supabase = await createSupabaseServerClient()

  const { data: eventi } = await supabase
    .from('eventi')
    .select(`
      id,
      nome,
      data_evento,
      percorsi (
        id,
        nome_percorso,
        km,
        dislivello_m,
        registrazioni (
          id,
          completato,
          km_effettivi,
          punti,
          atleti (
            id,
            nome,
            cognome
          )
        )
      )
    `)
    .eq('data_evento', data)
    .order('nome')

  if (!eventi?.length) return Response.json({ registrazioni: [] })

  // Appiattisce in una lista di partecipazioni
  const registrazioni = eventi.flatMap((ev) =>
    (ev.percorsi ?? []).flatMap((p) =>
      (p.registrazioni ?? []).map((r) => ({
        evento: ev.nome,
        percorso: p.nome_percorso,
        km: p.km,
        dislivello_m: p.dislivello_m,
        atleta: `${r.atleti?.nome ?? ''} ${r.atleti?.cognome ?? ''}`.trim(),
        completato: r.completato,
        km_effettivi: r.km_effettivi,
        punti: r.punti,
      }))
    )
  )

  return Response.json({ registrazioni })
}

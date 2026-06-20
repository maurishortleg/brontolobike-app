import { createSupabaseServerClient } from '@/lib/supabase-server'

// GET /api/miei-eventi
// Restituisce lo storico eventi dell'utente loggato, ordine cronologico inverso
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atletaId = user?.user_metadata?.atleta_id
  if (!atletaId) return Response.json({ eventi: [] })

  const { data: regs } = await supabase
    .from('registrazioni')
    .select(`
      id,
      completato,
      km_effettivi,
      punti,
      percorsi (
        nome_percorso,
        km,
        dislivello_m,
        tipologia,
        eventi (
          nome,
          data_evento,
          luogo,
          url
        )
      )
    `)
    .eq('atleta_id', atletaId)
    .order('created_at', { ascending: false })

  const eventi = (regs ?? []).map((r: any) => ({
    id: r.id,
    data: r.percorsi?.eventi?.data_evento ?? '',
    nome: r.percorsi?.eventi?.nome ?? '',
    luogo: r.percorsi?.eventi?.luogo ?? '',
    url: r.percorsi?.eventi?.url ?? null,
    percorso: r.percorsi?.nome_percorso ?? '',
    tipologia: r.percorsi?.tipologia ?? '',
    km: r.percorsi?.km ?? 0,
    dislivello_m: r.percorsi?.dislivello_m ?? 0,
    completato: r.completato,
    km_effettivi: r.km_effettivi,
    punti: r.punti ?? 0,
  }))

  return Response.json({ eventi })
}

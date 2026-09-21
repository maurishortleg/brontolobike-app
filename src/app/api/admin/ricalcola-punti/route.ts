import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/is-admin'

/**
 * POST /api/admin/ricalcola-punti
 * Ricalcola i punti di tutte le registrazioni in base alle tipologie_evento attuali.
 * Se viene passato { percorso_id } ricalcola solo quel percorso.
 * Se viene passato { evento_id }  ricalcola tutti i percorsi dell'evento.
 * Senza parametri ricalcola TUTTO (operazione pesante).
 */
export async function POST(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const admin = createSupabaseAdminClient()

  // Costruisci la query registrazioni con join su percorsi + tipologie
  let query = admin
    .from('registrazioni')
    .select(`
      id,
      km_effettivi,
      dislivello_eff,
      percorsi!inner (
        id,
        km,
        dislivello_m,
        tipologia_id,
        tipologie_evento ( coefficiente_km, punti_fissi, ignora_km_dislivello )
      )
    `)

  if (body.percorso_id) {
    query = query.eq('percorso_id', body.percorso_id)
  } else if (body.evento_id) {
    query = query.eq('percorsi.evento_id', body.evento_id)
  }

  const { data: regs, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })

  let aggiornate = 0
  let errori = 0

  for (const reg of regs ?? []) {
    const perc = reg.percorsi as unknown as {
      id: number
      km: number | null
      dislivello_m: number | null
      tipologia_id: number | null
      tipologie_evento: {
        coefficiente_km: number
        punti_fissi: number | null
        ignora_km_dislivello: boolean
      } | null
    }

    const tip = perc?.tipologie_evento
    if (!tip) continue // percorso senza tipologia — salta

    let punti: number
    if (tip.ignora_km_dislivello && tip.punti_fissi !== null) {
      punti = tip.punti_fissi
    } else {
      const km = reg.km_effettivi ?? perc.km ?? 0
      const dislivello = reg.dislivello_eff ?? perc.dislivello_m ?? 0
      punti = Math.ceil(km * tip.coefficiente_km + dislivello * 0.1)
    }

    const { error: updErr } = await admin
      .from('registrazioni')
      .update({ punti })
      .eq('id', reg.id)

    if (updErr) errori++
    else aggiornate++
  }

  return Response.json({ ok: true, aggiornate, errori, totale: regs?.length ?? 0 })
}

import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/is-admin'

// POST — aggiunge un percorso
export async function POST(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await req.json()
  const { evento_id, nome_percorso, km, dislivello_m, tipologia_id } = body
  if (!evento_id) return Response.json({ error: 'evento_id mancante' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { data, error } = await admin.from('percorsi').insert({
    evento_id, nome_percorso: nome_percorso || 'Percorso', km, dislivello_m, tipologia_id: tipologia_id || null
  }).select().single()
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ percorso: data })
}

// PATCH — aggiorna un percorso (e ricalcola i punti se cambia tipologia_id)
export async function PATCH(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await req.json()
  const { id, ...campi } = body
  if (!id) return Response.json({ error: 'id mancante' }, { status: 400 })

  const admin = createSupabaseAdminClient()

  // 1. Aggiorna il percorso
  const { error } = await admin.from('percorsi').update(campi).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  // 2. Se è cambiata tipologia_id (o km/dislivello_m), ricalcola i punti delle registrazioni collegate
  const ricalcola = campi.tipologia_id !== undefined || campi.km !== undefined || campi.dislivello_m !== undefined
  let regAggiornate = 0

  if (ricalcola) {
    // Leggi il percorso aggiornato (per km/dislivello correnti)
    const { data: percorso } = await admin.from('percorsi')
      .select('km, dislivello_m, tipologia_id')
      .eq('id', id)
      .single()

    if (percorso?.tipologia_id) {
      // Leggi la tipologia con i coefficienti
      const { data: tip } = await admin.from('tipologie_evento')
        .select('coefficiente_km, punti_fissi, ignora_km_dislivello')
        .eq('id', percorso.tipologia_id)
        .single()

      if (tip) {
        // Leggi tutte le registrazioni collegate a questo percorso
        const { data: regs } = await admin.from('registrazioni')
          .select('id, km_effettivi, dislivello_eff')
          .eq('percorso_id', id)

        for (const reg of regs ?? []) {
          let punti: number
          if (tip.ignora_km_dislivello && tip.punti_fissi !== null) {
            punti = tip.punti_fissi
          } else {
            const km = reg.km_effettivi ?? percorso.km ?? 0
            const dislivello = reg.dislivello_eff ?? percorso.dislivello_m ?? 0
            punti = Math.ceil(km * tip.coefficiente_km + dislivello * 0.1)
          }
          await admin.from('registrazioni').update({ punti }).eq('id', reg.id)
          regAggiornate++
        }
      }
    }
  }

  return Response.json({ ok: true, registrazioni_aggiornate: regAggiornate })
}

// DELETE — elimina un percorso
export async function DELETE(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'id mancante' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('percorsi').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

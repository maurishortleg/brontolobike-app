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

// PATCH — aggiorna un percorso
export async function PATCH(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await req.json()
  const { id, ...campi } = body
  if (!id) return Response.json({ error: 'id mancante' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('percorsi').update(campi).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
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

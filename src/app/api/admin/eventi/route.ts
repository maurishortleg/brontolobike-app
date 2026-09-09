import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/is-admin'

// GET /api/admin/eventi?q=...&page=0&limit=20
export async function GET(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const page = Number(req.nextUrl.searchParams.get('page') ?? 0)
  const limit = Number(req.nextUrl.searchParams.get('limit') ?? 20)
  const id = req.nextUrl.searchParams.get('id')

  const admin = createSupabaseAdminClient()

  if (id) {
    const { data: ev } = await admin.from('eventi').select('*').eq('id', id).single()
    const { data: percorsi } = await admin.from('percorsi')
      .select('id, nome_percorso, km, dislivello_m, tipologia_id, tipologie_evento(nome)')
      .eq('evento_id', id)
    return Response.json({ evento: ev, percorsi: percorsi ?? [] })
  }

  let query = admin.from('eventi').select('id, nome, data_evento, tipologia, luogo, stato, attivo', { count: 'exact' })
  if (q) query = query.ilike('nome', '%' + q + '%')
  const { data, count } = await query.order('data_evento', { ascending: false, nullsFirst: false }).range(page * limit, page * limit + limit - 1)

  return Response.json({ eventi: data ?? [], total: count ?? 0 })
}

// PATCH /api/admin/eventi — aggiorna un evento
export async function PATCH(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await req.json()
  const { id, ...campi } = body
  if (!id) return Response.json({ error: 'id mancante' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('eventi').update(campi).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

// DELETE /api/admin/eventi — elimina un evento e i suoi percorsi
export async function DELETE(req: NextRequest) {
  const sb = await createSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'id mancante' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  await admin.from('percorsi').delete().eq('evento_id', id)
  const { error } = await admin.from('eventi').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

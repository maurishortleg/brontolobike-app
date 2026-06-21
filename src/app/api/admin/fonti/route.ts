import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/is-admin'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 401 })

  const { data, error } = await supabase
    .from('fonti_eventi')
    .select('*')
    .order('id', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ fonti: data ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 401 })

  const body = await req.json()
  const { nome, dominio, url, queries } = body

  if (!nome?.trim() || !dominio?.trim() || !url?.trim()) {
    return Response.json({ error: 'nome, dominio e url sono obbligatori' }, { status: 400 })
  }

  const queriesArray = Array.isArray(queries)
    ? queries.filter((q: string) => q?.trim())
    : [`site:${dominio.trim()} ciclismo eventi ${new Date().getFullYear()} italia`]

  const { data, error } = await supabase
    .from('fonti_eventi')
    .insert({ nome: nome.trim(), dominio: dominio.trim(), url: url.trim(), queries: queriesArray })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ fonte: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id, ...update } = await req.json()
  if (!id) return Response.json({ error: 'id mancante' }, { status: 400 })

  const { error } = await supabase.from('fonti_eventi').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'id mancante' }, { status: 400 })

  const { error } = await supabase.from('fonti_eventi').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}

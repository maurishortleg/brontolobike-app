import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/is-admin'

// GET /api/admin/atleti — lista completa atleti
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data } = await supabase
    .from('atleti')
    .select('id, nome_cognome, categoria_corrente, categoria_prossima, numero_tessera, attivo')
    .order('nome_cognome')

  return Response.json({ atleti: data ?? [] })
}

// PATCH /api/admin/atleti — modifica atleta
export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const body = await req.json()
  const { id, ...fields } = body
  if (!id) return Response.json({ error: 'ID mancante' }, { status: 400 })

  // Campi consentiti
  const allowed = ['attivo', 'categoria_corrente', 'categoria_prossima', 'numero_tessera', 'nome_cognome']
  const update: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in fields) update[key] = fields[key]
  }

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('atleti').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

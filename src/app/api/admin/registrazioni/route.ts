import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/is-admin'

// GET /api/admin/registrazioni?atleta_id=xxx
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const atletaId = req.nextUrl.searchParams.get('atleta_id')
  if (!atletaId) return Response.json({ registrazioni: [] })

  const { data: regs } = await supabase
    .from('registrazioni')
    .select('id, completato, km_effettivi, punti, percorso_id')
    .eq('atleta_id', atletaId)
    .order('created_at', { ascending: false })

  const percorsoIds = (regs ?? []).map((r: any) => r.percorso_id)
  const { data: percorsi } = percorsoIds.length > 0
    ? await supabase.from('percorsi').select('id, nome_percorso, km, dislivello_m, evento_id').in('id', percorsoIds)
    : { data: [] }

  const eventoIds = [...new Set((percorsi ?? []).map((p: any) => p.evento_id))]
  const { data: eventi_db } = eventoIds.length > 0
    ? await supabase.from('eventi').select('id, nome, data_evento').in('id', eventoIds)
    : { data: [] }

  const percorsoMap = Object.fromEntries((percorsi ?? []).map((p: any) => [p.id, p]))
  const eventoMap = Object.fromEntries((eventi_db ?? []).map((e: any) => [e.id, e]))

  const registrazioni = (regs ?? []).map((r: any) => {
    const p = percorsoMap[r.percorso_id]
    const e = p ? eventoMap[p.evento_id] : null
    return {
      id: r.id,
      evento: e?.nome ?? '',
      data: e?.data_evento ?? '',
      percorso: p?.nome_percorso ?? '',
      km: p?.km ?? 0,
      dislivello_m: p?.dislivello_m ?? 0,
      completato: r.completato,
      km_effettivi: r.km_effettivi,
      punti: r.punti ?? 0,
    }
  })

  return Response.json({ registrazioni })
}

// DELETE /api/admin/registrazioni — elimina registrazione
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'ID mancante' }, { status: 400 })

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('registrazioni').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

// PATCH /api/admin/registrazioni — modifica punti o completato
export async function PATCH(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const { id, punti, completato, km_effettivi } = await req.json()
  if (!id) return Response.json({ error: 'ID mancante' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (punti !== undefined) update.punti = Number(punti)
  if (completato !== undefined) update.completato = completato
  if (km_effettivi !== undefined) update.km_effettivi = Number(km_effettivi)

  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('registrazioni').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

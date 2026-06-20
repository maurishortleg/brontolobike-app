import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/is-admin'

// GET /api/admin/registrazioni?atleta_id=xxx
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const atletaId = req.nextUrl.searchParams.get('atleta_id')
  if (!atletaId) return Response.json({ registrazioni: [] })

  const { data } = await supabase
    .from('registrazioni')
    .select(`
      id,
      completato,
      km_effettivi,
      dislivello_eff,
      punti,
      percorsi (
        nome_percorso,
        km,
        dislivello_m,
        tipologia,
        eventi ( nome, data_evento )
      )
    `)
    .eq('atleta_id', atletaId)
    .order('created_at', { ascending: false })

  const registrazioni = (data ?? []).map((r: any) => ({
    id: r.id,
    evento: r.percorsi?.eventi?.nome ?? '',
    data: r.percorsi?.eventi?.data_evento ?? '',
    percorso: r.percorsi?.nome_percorso ?? '',
    km: r.percorsi?.km ?? 0,
    dislivello_m: r.percorsi?.dislivello_m ?? 0,
    completato: r.completato,
    km_effettivi: r.km_effettivi,
    punti: r.punti ?? 0,
  }))

  return Response.json({ registrazioni })
}

// DELETE /api/admin/registrazioni — elimina registrazione
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'ID mancante' }, { status: 400 })

  const { error } = await supabase.from('registrazioni').delete().eq('id', id)
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

  const { error } = await supabase.from('registrazioni').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}

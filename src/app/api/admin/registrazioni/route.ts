import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/is-admin'

// GET /api/admin/registrazioni?atleta_id=xxx
// GET /api/admin/registrazioni?cerca_evento=xxx  — ricerca globale per nome evento
// GET /api/admin/registrazioni?all=1             — ultime 100 registrazioni con tutti i dettagli
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const atletaId = req.nextUrl.searchParams.get('atleta_id')
  const cercaEvento = req.nextUrl.searchParams.get('cerca_evento')
  const all = req.nextUrl.searchParams.get('all')

  // ── Ultime 100 registrazioni con dettagli completi ────────────────────────
  if (all === '1') {
    const admin = createSupabaseAdminClient()

    const { data: regs } = await admin
      .from('registrazioni')
      .select('id, atleta_id, percorso_id, punti, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    const percorsoIds = [...new Set((regs ?? []).map((r: any) => r.percorso_id).filter(Boolean))]
    const { data: percorsi } = percorsoIds.length > 0
      ? await admin.from('percorsi').select('id, nome_percorso, km, dislivello_m, evento_id, tipologia_id').in('id', percorsoIds)
      : { data: [] }

    const tipologiaIds = [...new Set((percorsi ?? []).map((p: any) => p.tipologia_id).filter(Boolean))]
    const { data: tipologie } = tipologiaIds.length > 0
      ? await admin.from('tipologie_evento').select('id, nome').in('id', tipologiaIds)
      : { data: [] }

    const eventoIds = [...new Set((percorsi ?? []).map((p: any) => p.evento_id).filter(Boolean))]
    const { data: eventi_db } = eventoIds.length > 0
      ? await admin.from('eventi').select('id, nome, data_evento').in('id', eventoIds)
      : { data: [] }

    const atletaIds = [...new Set((regs ?? []).map((r: any) => r.atleta_id).filter(Boolean))]
    const { data: atleti_db } = atletaIds.length > 0
      ? await admin.from('atleti').select('id, nome_cognome').in('id', atletaIds)
      : { data: [] }

    const percorsoMap = Object.fromEntries((percorsi ?? []).map((p: any) => [p.id, p]))
    const eventoMap = Object.fromEntries((eventi_db ?? []).map((e: any) => [e.id, e]))
    const atletaMap = Object.fromEntries((atleti_db ?? []).map((a: any) => [a.id, a]))
    const tipologiaMap = Object.fromEntries((tipologie ?? []).map((t: any) => [t.id, t]))

    const registrazioni = (regs ?? []).map((r: any) => {
      const p = percorsoMap[r.percorso_id]
      const e = p ? eventoMap[p.evento_id] : null
      const a = atletaMap[r.atleta_id]
      const t = p?.tipologia_id ? tipologiaMap[p.tipologia_id] : null
      return {
        id: r.id,
        atleta: a?.nome_cognome ?? '—',
        evento: e?.nome ?? '—',
        data: e?.data_evento ?? '',
        percorso: p?.nome_percorso ?? '—',
        tipologia: t?.nome ?? '—',
        punti: r.punti ?? 0,
        created_at: r.created_at,
      }
    })
    return Response.json({ registrazioni })
  }

  // Ricerca per nome evento globale
  if (cercaEvento) {
    const { data: eventi_match } = await supabase
      .from('eventi')
      .select('id, nome, data_evento')
      .ilike('nome', `%${cercaEvento}%`)
      .limit(20)

    if (!eventi_match?.length) return Response.json({ registrazioni: [] })

    const eventoIds = eventi_match.map((e: any) => e.id)
    const { data: percorsi_match } = await supabase
      .from('percorsi')
      .select('id, nome_percorso, km, dislivello_m, evento_id, tipologia_id')
      .in('evento_id', eventoIds)

    const percorsoIds = (percorsi_match ?? []).map((p: any) => p.id)
    if (!percorsoIds.length) return Response.json({ registrazioni: [] })

    const { data: regs } = await supabase
      .from('registrazioni')
      .select('id, atleta_id, completato, km_effettivi, dislivello_eff, punti, percorso_id, created_at')
      .in('percorso_id', percorsoIds)
      .order('created_at', { ascending: false })

    const atletaIds = [...new Set((regs ?? []).map((r: any) => r.atleta_id))]
    const { data: atleti_match } = atletaIds.length > 0
      ? await supabase.from('atleti').select('id, nome_cognome').in('id', atletaIds)
      : { data: [] }

    const atletaMap = Object.fromEntries((atleti_match ?? []).map((a: any) => [a.id, a]))
    const percorsoMap = Object.fromEntries((percorsi_match ?? []).map((p: any) => [p.id, p]))
    const eventoMap = Object.fromEntries((eventi_match ?? []).map((e: any) => [e.id, e]))

    const registrazioni = (regs ?? []).map((r: any) => {
      const p = percorsoMap[r.percorso_id]
      const e = p ? eventoMap[p.evento_id] : null
      const a = atletaMap[r.atleta_id]
      return {
        id: r.id,
        atleta: a?.nome_cognome ?? r.atleta_id,
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

// DELETE /api/admin/registrazioni — elimina registrazione (anche altrui)
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const { id } = await req.json()
  if (!id) return Response.json({ error: 'ID mancante' }, { status: 400 })

  // Usa service_role: l'admin può eliminare registrazioni altrui,
  // la policy RLS "Delete registrazioni proprio" bloccherebbe il client normale.
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

  // Usa service_role: l'admin modifica registrazioni altrui (la RLS blocca il client normale)
  const admin = createSupabaseAdminClient()
  const { error } = await admin.from('registrazioni').update(update).eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true })
}


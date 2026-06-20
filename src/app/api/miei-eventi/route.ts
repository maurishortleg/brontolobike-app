import { createSupabaseServerClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atletaId = user?.user_metadata?.atleta_id
  if (!atletaId) return Response.json({ eventi: [] })

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
    ? await supabase.from('eventi').select('id, nome, data_evento, luogo, url').in('id', eventoIds)
    : { data: [] }

  const percorsoMap = Object.fromEntries((percorsi ?? []).map((p: any) => [p.id, p]))
  const eventoMap = Object.fromEntries((eventi_db ?? []).map((e: any) => [e.id, e]))

  const eventi = (regs ?? []).map((r: any) => {
    const p = percorsoMap[r.percorso_id]
    const e = p ? eventoMap[p.evento_id] : null
    return {
      id: r.id,
      data: e?.data_evento ?? '',
      nome: e?.nome ?? '',
      luogo: e?.luogo ?? '',
      url: e?.url ?? null,
      percorso: p?.nome_percorso ?? '',
      tipologia: '',
      km: p?.km ?? 0,
      dislivello_m: p?.dislivello_m ?? 0,
      completato: r.completato,
      km_effettivi: r.km_effettivi,
      punti: r.punti ?? 0,
    }
  })

  return Response.json({ eventi })
}

import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/is-admin'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  const atletaIdCorrente = user?.user_metadata?.atleta_id ?? null
  const isMe = atletaIdCorrente === id
  const canSeeEvents = isMe || isAdmin(user)

  const anno = new Date().getFullYear()
  const inizioAnno = `${anno}-01-01`

  // 1. Dati atleta
  const { data: atletaList } = await supabase
    .from('atleti')
    .select('id, nome_cognome, categoria_corrente, numero_tessera')
    .filter('id', 'eq', id)
    .limit(1)

  const atleta = atletaList?.[0] ?? null
  if (!atleta) return Response.json({ error: 'Atleta non trovato' }, { status: 404 })

  // 2. Tutti gli eventi dell'anno (una volta sola)
  const { data: eventiAnno } = await supabase
    .from('eventi')
    .select('id, nome, data_evento, luogo, url')
    .gte('data_evento', inizioAnno)

  const eventoIdSet = new Set((eventiAnno ?? []).map((e: any) => e.id))
  const eventoMap = Object.fromEntries((eventiAnno ?? []).map((e: any) => [e.id, e]))

  // 3. Tutti i percorsi collegati a eventi dell'anno
  const eventoIds = [...eventoIdSet]
  const { data: percorsiAnno } = eventoIds.length > 0
    ? await supabase.from('percorsi').select('id, nome_percorso, km, dislivello_m, evento_id').in('evento_id', eventoIds)
    : { data: [] }

  const percorsoMap = Object.fromEntries((percorsiAnno ?? []).map((p: any) => [p.id, p]))
  const percorsoIdSet = new Set(Object.keys(percorsoMap))

  // 4. Registrazioni dell'atleta
  const { data: regs } = await supabase
    .from('registrazioni')
    .select('id, completato, km_effettivi, punti, percorso_id')
    .eq('atleta_id', id)
    .order('created_at', { ascending: false })

  // 5. Punti anno corrente
  const puntiTotali = (regs ?? []).reduce((acc, r: any) => {
    if (percorsoIdSet.has(String(r.percorso_id))) return acc + (r.punti ?? 0)
    return acc
  }, 0)

  // 6. Posizione: una sola query per tutte le registrazioni della categoria dell'anno
  const { data: atletiCategoria } = await supabase
    .from('atleti')
    .select('id')
    .eq('categoria_corrente', atleta.categoria_corrente)
    .eq('attivo', true)
    .neq('id', id)

  const altriIds = (atletiCategoria ?? []).map((a: any) => a.id)

  const { data: regsAltri } = altriIds.length > 0
    ? await supabase
        .from('registrazioni')
        .select('atleta_id, punti, percorso_id')
        .in('atleta_id', altriIds)
    : { data: [] }

  // Somma punti per atleta (solo percorsi di eventi dell'anno)
  const puntiAltri: Record<string, number> = {}
  for (const r of regsAltri ?? []) {
    if (!percorsoIdSet.has(String(r.percorso_id))) continue
    const aid = r.atleta_id as string
    puntiAltri[aid] = (puntiAltri[aid] ?? 0) + (r.punti ?? 0)
  }

  const posizione = 1 + Object.values(puntiAltri).filter((p) => p > puntiTotali).length

  const sogliaFinisher = atleta.categoria_corrente === 'AMATORI' ? 9000 : 4000
  const finisher = puntiTotali >= sogliaFinisher
  const progressione = Math.min(100, Math.round((puntiTotali / sogliaFinisher) * 100))

  // 7. Storico eventi (solo atleta o admin)
  const storicoEventi = canSeeEvents
    ? (regs ?? [])
        .map((r: any) => {
          const p = percorsoMap[r.percorso_id]
          const e = p ? eventoMap[p.evento_id] : null
          if (!e) return null
          return {
            data: e.data_evento,
            nome: e.nome,
            luogo: e.luogo ?? '',
            url: e.url ?? null,
            percorso: p.nome_percorso ?? '',
            tipologia: '',
            km: p.km ?? 0,
            dislivello_m: p.dislivello_m ?? 0,
            completato: r.completato,
            km_effettivi: r.km_effettivi,
            punti: r.punti ?? 0,
          }
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.data.localeCompare(a.data))
    : null

  return Response.json({
    atleta: {
      id: atleta.id,
      nome: atleta.nome_cognome,
      categoria: atleta.categoria_corrente,
      numero_tessera: atleta.numero_tessera ?? null,
    },
    puntiTotali,
    posizione,
    finisher,
    progressione,
    sogliaFinisher,
    isMe,
    canSeeEvents,
    eventi: storicoEventi,
  })
}

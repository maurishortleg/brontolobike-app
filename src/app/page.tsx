import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { isAdmin } from '@/lib/is-admin'
import { TIPOLOGIE_LIBERE } from '@/lib/classifica-tipologia'
import Link from 'next/link'
import HomeEventiList, { type EventoUnificato } from './HomeEventiList'

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const atletaId = user?.user_metadata?.atleta_id ?? null
  const admin = isAdmin(user)

  // ── Fetch eventi da entrambe le sorgenti in parallelo ────────────────────
  const anonClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [
    { data: eventiRicercati },
    { data: eventiLiberiRaw },
    { data: eventiDb },
    { data: percorsiDb },
  ] = await Promise.all([
    // 1. eventi_ricercati con data fissa (esclusi tipologie libere)
    anonClient
      .from('eventi_ricercati')
      .select('id, nome, data, data_fine, luogo, tipologia, url, percorsi, immagine_url')
      .eq('attivo', true)
      .not('data', 'is', null)
      .not('tipologia', 'in', `(${TIPOLOGIE_LIBERE.map(t => `"${t}"`).join(',')})`)
      .order('data', { ascending: true }),

    // 2. eventi liberi (Brevetti Permanenti, Percorso con Credenziale) — senza vincolo data
    anonClient
      .from('eventi_ricercati')
      .select('id, nome, data, data_fine, luogo, tipologia, url, percorsi, immagine_url')
      .eq('attivo', true)
      .in('tipologia', TIPOLOGIE_LIBERE)
      .order('nome', { ascending: true }),

    // 3. eventi DB — solo colonne che esistono di sicuro
    anonClient
      .from('eventi')
      .select('id, nome, data_evento')
      .order('data_evento', { ascending: true }),

    // 4. percorsi
    anonClient
      .from('percorsi')
      .select('id, evento_id, nome_percorso, km, dislivello_m'),
  ])

  // ── Normalizza eventi_ricercati ─────────────────────────────────────────
  type RawPercorsoRicercato = { nome: string; km: number | null; dislivello: number | null; tipologia: string | null }

  type RawEventoRicercato = {
    id: string; nome: string; data: string | null; data_fine: string | null
    luogo: string | null; tipologia: string | null; url: string | null
    percorsi: RawPercorsoRicercato[]; immagine_url: string | null
  }

  const normalizzaRicercato = (ev: RawEventoRicercato, libero = false): EventoUnificato => ({
    id: `ricercato-${ev.id}`,
    sorgente: 'ricercato' as const,
    nome: ev.nome,
    data: ev.data,
    data_fine: ev.data_fine ?? null,
    luogo: ev.luogo ?? null,
    tipologia: ev.tipologia ?? null,
    url: ev.url ?? null,
    immagine_url: ev.immagine_url ?? null,
    isLibero: libero,
    percorsi: Array.isArray(ev.percorsi)
      ? (ev.percorsi as RawPercorsoRicercato[]).map((p) => ({
          nome: p.nome ?? '',
          km: p.km ?? null,
          dislivello: p.dislivello ?? null,
          tipologia: p.tipologia ?? null,
        }))
      : [],
  })

  const listaRicercati: EventoUnificato[] = (eventiRicercati ?? []).map((ev) => normalizzaRicercato(ev, false))
  const listaLiberi: EventoUnificato[]    = (eventiLiberiRaw ?? []).map((ev) => normalizzaRicercato(ev, true))

  // ── Normalizza eventi DB + percorsi ────────────────────────────────────
  const percorsiPerEvento: Record<string, EventoUnificato['percorsi']> = {}
  for (const p of percorsiDb ?? []) {
    const eid = String(p.evento_id)
    if (!percorsiPerEvento[eid]) percorsiPerEvento[eid] = []
    percorsiPerEvento[eid].push({
      nome: p.nome_percorso ?? 'Percorso unico',
      km: p.km ?? null,
      dislivello: p.dislivello_m ?? null,
      tipologia: null,
    })
  }

  // Deduplica: rimuove eventi DB il cui nome esiste già in eventi_ricercati
  const nomiRicercati = new Set(
    [...listaRicercati, ...listaLiberi].map((e) => e.nome.toLowerCase().trim())
  )

  const listaDb: EventoUnificato[] = (eventiDb ?? [])
    .filter((ev) => !nomiRicercati.has(ev.nome.toLowerCase().trim()))
    .map((ev) => ({
      id: `db-${ev.id}`,
      sorgente: 'db' as const,
      nome: ev.nome,
      data: ev.data_evento ?? null,
      data_fine: null,
      luogo: null,
      tipologia: percorsiPerEvento[String(ev.id)]?.[0]?.tipologia ?? null,
      url: null,
      isLibero: false,
      percorsi: percorsiPerEvento[String(ev.id)] ?? [],
    }))

  // ── Merge e sort per data (liberi in coda) ─────────────────────────────
  const tuttiEventi: EventoUnificato[] = [
    ...[...listaRicercati, ...listaDb].sort((a, b) => {
      if (!a.data && !b.data) return 0
      if (!a.data) return 1
      if (!b.data) return -1
      return a.data.localeCompare(b.data)
    }),
    ...listaLiberi,
  ]

  return (
    <main className="min-h-screen flex flex-col items-center px-4 pt-0 overflow-hidden">

      {/* Header hero con blocchi geometrici diagonali */}
      <div className="w-full relative overflow-hidden" style={{ minHeight: 220 }}>
        {/* Blocchi colore ispirati alla maglia */}
        <div className="absolute inset-0" style={{
          background: 'linear-gradient(108deg, #FF006E 0% 22%, #0055CC 22% 42%, #FF5500 42% 62%, #D8FF00 62% 100%)',
        }} />
        {/* Sovrapposizione scura per leggibilità */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(10,10,10,0.85) 100%)' }} />

        {/* Rombi decorativi */}
        <div className="absolute top-4 right-4 w-16 h-16 rotate-45 opacity-20" style={{ background: '#D8FF00' }} />
        <div className="absolute bottom-6 left-6 w-10 h-10 rotate-12 opacity-15" style={{ background: '#FF006E' }} />
        <div className="absolute top-10 right-20 w-6 h-6 rotate-45 opacity-25" style={{ background: '#fff' }} />

        {/* Contenuto header */}
        <div className="relative z-10 flex flex-col items-center justify-center pt-10 pb-8 px-4 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full" style={{ background: '#FF006E' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#0055CC' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#FF5500' }} />
            <div className="w-3 h-3 rounded-full" style={{ background: '#D8FF00' }} />
          </div>
          <h1 className="text-5xl font-black tracking-tight leading-none mb-1 bb-text-gradient drop-shadow-lg">
            BrontoloBike
          </h1>
          <p className="text-xs font-bold tracking-[0.25em] uppercase mt-2"
             style={{ color: 'rgba(255,255,255,0.55)' }}>
            Campionato Sociale {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* Contenuto principale */}
      <div className="w-full max-w-sm -mt-2 pb-10">

        {/* Pulsante principale */}
        <Link
          href="/registra"
          className="bb-btn-primary w-full py-4 rounded-2xl text-center block text-base mb-3 shadow-lg"
          style={{ boxShadow: '0 0 24px rgba(255,85,0,0.35)' }}
        >
          🚴 Registra evento
        </Link>

        {/* Card menu secondario */}
        <div className="bb-card rounded-2xl p-4 flex flex-col gap-2 mb-4">
          <Link href="/classifica" className="bb-btn-outline w-full py-3 rounded-xl text-center block text-sm">
            Classifica
          </Link>

          {user ? (
            <>
              {atletaId && (
                <Link href={`/atleta/${atletaId}`} className="bb-btn-outline w-full py-3 rounded-xl text-center block text-sm">
                  La mia scheda
                </Link>
              )}
              <Link href="/miei-eventi" className="bb-btn-outline w-full py-3 rounded-xl text-center block text-sm">
                I miei eventi
              </Link>
              <Link href="/calendario" className="bb-btn-outline w-full py-3 rounded-xl text-center block text-sm">
                Il mio calendario
              </Link>
              {!atletaId && (
                <Link
                  href="/collega-profilo"
                  className="w-full py-3 rounded-xl text-center block text-sm font-semibold transition-all"
                  style={{ border: '1.5px solid #D8FF00', color: '#D8FF00', background: 'rgba(216,255,0,0.06)' }}
                >
                  Collega il tuo profilo atleta
                </Link>
              )}
              {admin && (
                <Link
                  href="/admin"
                  className="w-full py-3 rounded-xl text-center block text-xs font-semibold transition-all"
                  style={{ border: '1.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)' }}
                >
                  Pannello Admin
                </Link>
              )}
            </>
          ) : (
            <Link href="/login" className="bb-btn-outline w-full py-3 rounded-xl text-center block text-sm">
              Accedi
            </Link>
          )}
        </div>

        {user && (
          <form action="/auth/logout" method="POST" className="text-center mb-6">
            <button type="submit" className="text-xs transition-colors bb-btn-logout">
              Esci ({user.email})
            </button>
          </form>
        )}

        {/* ── Lista eventi ─────────────────────────────────────────────── */}
        <div className="bb-card rounded-2xl p-4">
          <HomeEventiList eventi={tuttiEventi} />
        </div>

        {/* Decorazione geometrica bottom */}
        <div className="flex justify-center gap-3 mt-8 opacity-20">
          <div className="w-10 h-3 rounded-full rotate-12" style={{ background: '#FF006E' }} />
          <div className="w-10 h-3 rounded-full -rotate-6" style={{ background: '#0055CC' }} />
          <div className="w-10 h-3 rounded-full rotate-3"  style={{ background: '#FF5500' }} />
          <div className="w-10 h-3 rounded-full -rotate-12" style={{ background: '#D8FF00' }} />
        </div>
      </div>
    </main>
  )
}

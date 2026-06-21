import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/is-admin'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const atletaId = user?.user_metadata?.atleta_id ?? null
  const admin = isAdmin(user)

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

      {/* Menu */}
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
        <div className="bb-card rounded-2xl p-4 flex flex-col gap-2 mb-3">
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
          <form action="/auth/logout" method="POST" className="text-center">
            <button type="submit" className="text-xs transition-colors bb-btn-logout">
              Esci ({user.email})
            </button>
          </form>
        )}

        {/* Decorazione geometrica bottom */}
        <div className="flex justify-center gap-3 mt-10 opacity-20">
          <div className="w-10 h-3 rounded-full rotate-12" style={{ background: '#FF006E' }} />
          <div className="w-10 h-3 rounded-full -rotate-6" style={{ background: '#0055CC' }} />
          <div className="w-10 h-3 rounded-full rotate-3"  style={{ background: '#FF5500' }} />
          <div className="w-10 h-3 rounded-full -rotate-12" style={{ background: '#D8FF00' }} />
        </div>
      </div>
    </main>
  )
}

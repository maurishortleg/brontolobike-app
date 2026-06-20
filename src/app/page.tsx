import { createSupabaseServerClient } from '@/lib/supabase-server'
import { isAdmin } from '@/lib/is-admin'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const atletaId = user?.user_metadata?.atleta_id ?? null
  const admin = isAdmin(user)

  return (
    <main className="min-h-screen flex flex-col items-center justify-start px-4 pt-0">
      {/* Striscia decorativa top con gradiente maglia */}
      <div className="bb-stripe w-full h-2 mb-0" />

      <div className="flex flex-col items-center justify-center flex-1 w-full max-w-sm py-10">
        {/* Logo / Titolo */}
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold tracking-tight mb-1"
              style={{ background: 'linear-gradient(105deg, #ec4899 0%, #f97316 50%, #84cc16 100%)',
                       WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            BrontoloBike
          </h1>
          <p className="text-gray-400 text-sm font-medium tracking-wide uppercase">
            Campionato Sociale {new Date().getFullYear()}
          </p>
        </div>

        {/* Menu card */}
        <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col gap-3">
          <Link
            href="/registra"
            className="w-full text-white font-semibold py-3 rounded-xl transition-all text-center"
            style={{ background: 'linear-gradient(105deg, #f97316, #fb923c)' }}
          >
            Registra evento
          </Link>

          <Link
            href="/classifica"
            className="w-full border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 font-semibold py-3 rounded-xl transition-colors text-center"
          >
            Classifica
          </Link>

          {user ? (
            <>
              {atletaId && (
                <Link
                  href={`/atleta/${atletaId}`}
                  className="w-full border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 font-semibold py-3 rounded-xl transition-colors text-center"
                >
                  La mia scheda
                </Link>
              )}
              <Link
                href="/miei-eventi"
                className="w-full border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 font-semibold py-3 rounded-xl transition-colors text-center"
              >
                I miei eventi
              </Link>
              <Link
                href="/calendario"
                className="w-full border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 font-semibold py-3 rounded-xl transition-colors text-center"
              >
                Il mio calendario
              </Link>
              {!atletaId && (
                <Link
                  href="/collega-profilo"
                  className="w-full border border-orange-200 text-orange-600 hover:bg-orange-50 font-semibold py-3 rounded-xl transition-colors text-center"
                >
                  Collega il tuo profilo atleta
                </Link>
              )}
              {admin && (
                <Link
                  href="/admin"
                  className="w-full border border-gray-200 text-gray-500 hover:border-gray-300 font-semibold py-3 rounded-xl transition-colors text-center text-sm"
                >
                  Pannello Admin
                </Link>
              )}
              <div className="border-t border-gray-100 pt-2 mt-1">
                <form action="/auth/logout" method="POST">
                  <button type="submit" className="text-sm text-gray-400 hover:text-red-400 transition-colors w-full text-center">
                    Esci ({user.email})
                  </button>
                </form>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="w-full border border-gray-200 text-gray-700 hover:border-orange-300 hover:text-orange-600 font-semibold py-3 rounded-xl transition-colors text-center"
            >
              Accedi
            </Link>
          )}
        </div>

        {/* Decorazione geometrica sotto */}
        <div className="mt-8 flex gap-2 opacity-30">
          <div className="w-8 h-8 rounded-md rotate-12" style={{ background: '#f97316' }} />
          <div className="w-8 h-8 rounded-md -rotate-6" style={{ background: '#ec4899' }} />
          <div className="w-8 h-8 rounded-md rotate-3"  style={{ background: '#a3e635' }} />
        </div>
      </div>
    </main>
  )
}

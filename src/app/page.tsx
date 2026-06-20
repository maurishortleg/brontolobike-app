import { createSupabaseServerClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  const atletaId = user?.user_metadata?.atleta_id ?? null

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center max-w-sm w-full">
        <h1 className="text-4xl font-extrabold text-orange-500 tracking-tight mb-2">
          BrontoloBike
        </h1>
        <p className="text-gray-500 mb-8">Campionato Sociale 2027</p>

        <div className="bg-white rounded-2xl shadow p-6 flex flex-col gap-3">
          <Link
            href="/registra"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            Registra evento
          </Link>

          <Link
            href="/calendario"
            className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 rounded-lg transition-colors"
          >
            Il mio calendario
          </Link>

          <Link
            href="/miei-eventi"
            className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 rounded-lg transition-colors"
          >
            I miei eventi
          </Link>

          <Link
            href="/classifica"
            className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 rounded-lg transition-colors"
          >
            Classifica
          </Link>

          {user ? (
            <>
              {!atletaId && (
                <Link
                  href="/collega-profilo"
                  className="w-full border border-orange-300 text-orange-600 hover:bg-orange-50 font-semibold py-3 rounded-lg transition-colors"
                >
                  Collega il tuo profilo atleta
                </Link>
              )}
              <form action="/auth/logout" method="POST">
                <button type="submit" className="text-sm text-red-400 hover:underline w-full">
                  Esci ({user.email})
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold py-3 rounded-lg transition-colors"
            >
              Accedi
            </Link>
          )}
        </div>
      </div>
    </main>
  )
}

import { createSupabaseServerClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-4xl font-extrabold text-orange-500 tracking-tight mb-2">
          BrontoloBike
        </h1>
        <p className="text-gray-500 mb-8">Campionato Sociale 2027</p>

        {user ? (
          <div className="bg-white rounded-2xl shadow p-6 max-w-sm mx-auto">
            <p className="text-gray-700 mb-1">Bentornato!</p>
            <p className="font-semibold text-gray-900 mb-4">{user.email}</p>
            <form action="/auth/logout" method="POST">
              <button type="submit" className="text-sm text-red-500 hover:underline">
                Esci
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/login"
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
          >
            Accedi
          </Link>
        )}
      </div>
    </main>
  )
}

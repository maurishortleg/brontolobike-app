import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Client Supabase server-side con gestione cookie (per autenticazione SSR)
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // In Server Components i cookie non possono essere scritti — ignorabile
          }
        },
      },
    }
  )
}

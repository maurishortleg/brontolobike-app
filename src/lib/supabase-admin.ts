import { createClient } from '@supabase/supabase-js'

// Client con service_role key — bypassa RLS, usare SOLO nelle API server-side admin
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

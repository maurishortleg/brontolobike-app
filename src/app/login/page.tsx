import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import LoginClient from './LoginClient'

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  const { data: atleti } = await supabase
    .from('atleti')
    .select('id, nome_cognome, categoria_corrente')
    .eq('attivo', true)
    .order('nome_cognome')

  return <LoginClient atleti={atleti ?? []} />
}

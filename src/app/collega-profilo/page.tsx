import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import CollegaProfiloClient from './CollegaProfiloClient'

export default async function CollegaProfiloPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (user.user_metadata?.atleta_id) redirect('/')

  const { data: atleti } = await supabase
    .from('atleti')
    .select('id, nome_cognome, categoria_corrente')
    .order('nome_cognome')

  return <CollegaProfiloClient atleti={atleti ?? []} />
}

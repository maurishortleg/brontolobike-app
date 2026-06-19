import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import RegistraClient from './RegistraClient'

export default async function RegistraPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Utenti Google devono prima collegare il profilo atleta
  if (user && !user.user_metadata?.atleta_id) {
    redirect('/collega-profilo')
  }

  const atletaIdServer = user?.user_metadata?.atleta_id ?? null

  const [{ data: tipologie }, { data: stagione }] = await Promise.all([
    supabase.from('tipologie_evento').select('*').order('nome'),
    supabase.from('stagioni').select('id').eq('attiva', true).single(),
  ])

  if (!stagione) {
    return <p className="p-8 text-center text-red-500">Nessuna stagione attiva trovata.</p>
  }

  return (
    <RegistraClient
      tipologie={tipologie ?? []}
      atletaIdServer={atletaIdServer}
      stagione_id={stagione.id}
    />
  )
}

import { createSupabaseServerClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import RegistraClient from './RegistraClient'

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function RegistraPage({ searchParams }: Props) {
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

  // ── Leggi query params per pre-compilazione da lista eventi ──────────────
  const sp = await searchParams
  const eventoIniziale = sp.nome
    ? {
        nome: sp.nome,
        data: sp.data ?? null,
        luogo: sp.luogo ?? null,
        url: sp.url ?? null,
        tipologia: sp.tipologia ?? null,
        percorso: sp.percorso_nome
          ? {
              nome: sp.percorso_nome,
              km: sp.percorso_km ? Number(sp.percorso_km) : null,
              dislivello: sp.percorso_dislivello ? Number(sp.percorso_dislivello) : null,
              tipologia: sp.percorso_tipologia ?? null,
            }
          : null,
      }
    : null

  return (
    <RegistraClient
      tipologie={tipologie ?? []}
      atletaIdServer={atletaIdServer}
      stagione_id={stagione.id}
      eventoIniziale={eventoIniziale}
    />
  )
}

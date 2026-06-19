'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

type Atleta = { id: string; nome_cognome: string; categoria_corrente: string }

export default function CollegaProfiloClient({ atleti }: { atleti: Atleta[] }) {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()
  const [ricerca, setRicerca] = useState('')
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')

  const atletiFiltrati = atleti.filter((a) =>
    a.nome_cognome.toLowerCase().includes(ricerca.toLowerCase())
  )

  async function collegaAtleta(atleta: Atleta) {
    setLoading(true)
    setErrore('')
    const { error } = await supabase.auth.updateUser({
      data: { atleta_id: atleta.id, atleta_nome: atleta.nome_cognome },
    })
    if (error) {
      setErrore('Errore nel collegamento. Riprova.')
      setLoading(false)
      return
    }
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-10 px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Collega il tuo profilo</h1>
        <p className="text-gray-500 text-sm mb-5">
          Seleziona il tuo nome dalla lista atleti. Lo farai una volta sola.
        </p>
        {errore && <p className="text-red-500 text-sm mb-3">{errore}</p>}
        <input
          type="text"
          placeholder="Cerca per nome o cognome..."
          value={ricerca}
          onChange={(e) => setRicerca(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-orange-400"
          autoFocus
        />
        <div className="max-h-96 overflow-y-auto divide-y divide-gray-100">
          {atletiFiltrati.length === 0 ? (
            <p className="text-gray-500 text-sm py-4 text-center">Nessun atleta trovato</p>
          ) : (
            atletiFiltrati.map((a) => (
              <button
                key={a.id}
                onClick={() => collegaAtleta(a)}
                disabled={loading}
                className="w-full text-left px-3 py-3 hover:bg-orange-50 transition-colors flex justify-between items-center"
              >
                <span className="font-medium text-gray-800">{a.nome_cognome}</span>
                <span className="text-xs text-gray-400 capitalize">
                  {a.categoria_corrente.toLowerCase()}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

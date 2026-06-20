'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type Atleta = { id: string; nome_cognome: string; categoria_corrente: string }

export default function LoginClient({ atleti }: { atleti: Atleta[] }) {
  const supabase = createSupabaseBrowserClient()
  const [modalitaSenzaLogin, setModalitaSenzaLogin] = useState(false)
  const [ricerca, setRicerca] = useState('')
  const [loading, setLoading] = useState(false)

  const atletiFiltrati = atleti.filter((a) =>
    a.nome_cognome.toLowerCase().includes(ricerca.toLowerCase())
  )

  async function loginGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function loginFacebook() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'facebook',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
  }

  async function selezionaAtleta(atleta: Atleta) {
    setLoading(true)
    // Sessione anonima: salva l'atleta selezionato in localStorage
    localStorage.setItem('atleta_selezionato', JSON.stringify(atleta))
    window.location.href = '/'
  }

  if (modalitaSenzaLogin) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start pt-10 px-4">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow p-6">
          <button
            onClick={() => setModalitaSenzaLogin(false)}
            className="text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
          >
            ← Torna indietro
          </button>
          <h2 className="text-xl font-bold text-gray-800 mb-4">
            Seleziona il tuo nome
          </h2>
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
              <p className="text-gray-500 text-sm py-4 text-center">
                Nessun atleta trovato
              </p>
            ) : (
              atletiFiltrati.map((a) => (
                <button
                  key={a.id}
                  onClick={() => selezionaAtleta(a)}
                  disabled={loading}
                  className="w-full text-left px-3 py-3 hover:bg-orange-50 transition-colors flex justify-between items-center"
                >
                  <span className="font-medium text-gray-800">
                    {a.nome_cognome}
                  </span>
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow p-8 flex flex-col items-center gap-5">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-orange-500 tracking-tight">
            BrontoloBike
          </h1>
          <p className="text-gray-500 text-sm mt-1">Campionato Sociale {new Date().getFullYear()}</p>
        </div>

        <button
          onClick={loginGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 border border-gray-300 rounded-lg px-4 py-3 hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Accedi con Google
        </button>

        <button
          onClick={loginFacebook}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-[#1877F2] rounded-lg px-4 py-3 hover:bg-[#166fe5] transition-colors font-medium text-white disabled:opacity-50"
        >
          <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          Accedi con Facebook
        </button>

        <div className="w-full flex items-center gap-3 text-gray-400 text-sm">
          <div className="flex-1 h-px bg-gray-200" />
          oppure
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        <button
          onClick={() => setModalitaSenzaLogin(true)}
          disabled={loading}
          className="w-full border border-orange-300 rounded-lg px-4 py-3 hover:bg-orange-50 transition-colors font-medium text-orange-600 disabled:opacity-50"
        >
          Continua senza account
        </button>

        <p className="text-xs text-gray-400 text-center">
          Seleziona il tuo nome dalla lista atleti senza creare un account
        </p>
      </div>
    </div>
  )
}

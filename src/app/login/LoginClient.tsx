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
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        // La sessione viene salvata in localStorage: rimane attiva
        // tra una visita e l'altra senza dover rifare il login.
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    })
  }

  async function selezionaAtleta(atleta: Atleta) {
    setLoading(true)
    localStorage.setItem('atleta_selezionato', JSON.stringify(atleta))
    window.location.href = '/'
  }

  // ── Vista selezione atleta (senza account) ────────────────────────────────
  if (modalitaSenzaLogin) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0f0f0f',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 32,
        paddingLeft: 16,
        paddingRight: 16,
      }}>
        <div style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 20,
          padding: 24,
          backdropFilter: 'blur(12px)',
        }}>
          <button
            onClick={() => setModalitaSenzaLogin(false)}
            style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.45)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: 0,
            }}
          >
            ← Torna indietro
          </button>

          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', marginBottom: 4 }}>
            Seleziona il tuo nome
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>
            Accesso senza account — solo per uso interno del team
          </p>

          <input
            type="text"
            placeholder="Cerca per nome o cognome..."
            value={ricerca}
            onChange={(e) => setRicerca(e.target.value)}
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.07)',
              color: '#ffffff',
              fontSize: 14,
              marginBottom: 12,
              boxSizing: 'border-box',
              outline: 'none',
            }}
          />

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {atletiFiltrati.length === 0 ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', textAlign: 'center', padding: '16px 0' }}>
                Nessun atleta trovato
              </p>
            ) : (
              atletiFiltrati.map((a) => (
                <button
                  key={a.id}
                  onClick={() => selezionaAtleta(a)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '12px 14px',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,85,0,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>
                    {a.nome_cognome}
                  </span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textTransform: 'capitalize' }}>
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

  // ── Vista principale login ─────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f0f0f',
      backgroundImage: [
        'radial-gradient(ellipse 70% 50% at 100% 0%, rgba(216,255,0,0.08) 0%, transparent 65%)',
        'radial-gradient(ellipse 60% 40% at 0% 100%, rgba(255,0,110,0.07) 0%, transparent 65%)',
      ].join(', '),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 360,
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 24,
        padding: 36,
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 24,
      }}>

        {/* Logo */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 10 }}>
            {['#FF006E', '#0055CC', '#FF5500', '#D8FF00'].map(c => (
              <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
            ))}
          </div>
          <h1 style={{
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(105deg, #FF006E 0%, #FF5500 45%, #D8FF00 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            marginBottom: 4,
          }}>
            BrontoloBike
          </h1>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
            Campionato Sociale {new Date().getFullYear()}
          </p>
        </div>

        {/* Pulsante Google */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={loginGoogle}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              padding: '13px 20px',
              borderRadius: 12,
              background: '#ffffff',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 14,
              color: '#1f2937',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.15s, transform 0.1s',
              boxShadow: '0 0 20px rgba(255,255,255,0.08)',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {/* Google G logo */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Accesso in corso...' : 'Accedi con Google'}
          </button>

          {/* Nota sessione persistente */}
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>
            🔒 Rimarrai connesso tra una visita e l&apos;altra
          </p>
        </div>

        {/* Separatore */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>oppure</span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Accesso senza account */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={() => setModalitaSenzaLogin(true)}
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px 20px',
              borderRadius: 12,
              background: 'transparent',
              border: '1.5px solid rgba(255,85,0,0.4)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              fontSize: 14,
              color: '#FF5500',
              opacity: loading ? 0.6 : 1,
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = '#FF5500'
              e.currentTarget.style.background = 'rgba(255,85,0,0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,85,0,0.4)'
              e.currentTarget.style.background = 'transparent'
            }}
          >
            Continua senza account
          </button>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center' }}>
            Seleziona il tuo nome dalla lista atleti del team
          </p>
        </div>

      </div>
    </div>
  )
}

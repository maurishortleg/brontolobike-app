'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'

type EventoPersonale = {
  id: string
  data: string
  nome: string
  luogo: string
  url: string | null
  percorso: string
  tipologia: string
  km: number
  dislivello_m: number
  completato: boolean
  km_effettivi: number
  punti: number
}

export default function MieiEventiClient() {
  const [eventi, setEventi] = useState<EventoPersonale[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/miei-eventi')
      .then((r) => r.json())
      .then((d) => setEventi(d.eventi ?? []))
      .catch(() => setEventi([]))
      .finally(() => setLoading(false))
  }, [])

  const puntiTotali = eventi.reduce((acc, e) => acc + e.punti, 0)

  return (
    <PageShell title="I miei eventi">
      <div>

        {!loading && eventi.length > 0 && (
          <div className="bg-orange-500 text-white rounded-xl px-4 py-3 mb-4 flex justify-between items-center">
            <span className="font-semibold">{eventi.length} eventi registrati</span>
            <span className="font-bold text-lg">{puntiTotali.toLocaleString('it-IT')} pt</span>
          </div>
        )}

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Caricamento...</div>
        ) : eventi.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Nessun evento registrato.{' '}
            <Link href="/registra" className="text-orange-500 hover:underline">Registra il primo →</Link>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {eventi.map((e) => (
              <div key={e.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 mb-0.5">
                      {new Date(e.data + 'T12:00:00').toLocaleDateString('it-IT', {
                        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                      })}
                      {e.luogo ? ` · ${e.luogo}` : ''}
                    </div>
                    <div className="font-semibold text-gray-900 truncate">{e.nome}</div>
                    <div className="text-sm text-gray-500 mt-0.5">
                      {e.percorso} · {e.km} km · {e.dislivello_m} m ↑
                    </div>
                    {e.tipologia && (
                      <div className="text-xs text-gray-400 mt-0.5">{e.tipologia}</div>
                    )}
                    {!e.completato && (
                      <span className="inline-block mt-1 text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
                        parziale · {e.km_effettivi} km
                      </span>
                    )}
                    {e.url && (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-1 text-xs text-blue-500 hover:underline"
                      >
                        LINK ↗
                      </a>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-orange-500 text-lg">{e.punti}</div>
                    <div className="text-xs text-gray-400">pt</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}

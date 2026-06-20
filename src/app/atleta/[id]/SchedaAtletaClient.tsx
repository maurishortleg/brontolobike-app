'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Evento = {
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

type Scheda = {
  atleta: { id: string; nome: string; categoria: string; numero_tessera: string | null }
  puntiTotali: number
  posizione: number
  finisher: boolean
  progressione: number
  sogliaFinisher: number
  isMe: boolean
  canSeeEvents: boolean
  eventi: Evento[] | null
}

export default function SchedaAtletaClient({ atletaId }: { atletaId: string }) {
  const [scheda, setScheda] = useState<Scheda | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState(false)

  useEffect(() => {
    fetch(`/api/atleta/${atletaId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then(setScheda)
      .catch(() => setErrore(true))
      .finally(() => setLoading(false))
  }, [atletaId])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
      Caricamento...
    </div>
  )

  if (errore || !scheda) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-sm text-gray-400">
      Atleta non trovato. <Link href="/" className="ml-2 text-orange-500 hover:underline">← Home</Link>
    </div>
  )

  const { atleta, puntiTotali, posizione, finisher, progressione, sogliaFinisher, isMe, canSeeEvents, eventi } = scheda
  const anno = new Date().getFullYear()
  const categoriaLabel = atleta.categoria === 'AMATORI' ? 'Amatori' : 'Cicloturisti'

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/classifica" className="text-gray-400 hover:text-gray-600 text-sm">← Classifica</Link>
        </div>

        {/* Card principale */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h1 className="text-xl font-bold text-gray-900">{atleta.nome}</h1>
              <div className="text-sm text-gray-500 mt-0.5">
                {categoriaLabel}
                {atleta.numero_tessera && (
                  <span className="ml-2 text-gray-400">· Tessera {atleta.numero_tessera}</span>
                )}
              </div>
            </div>
            {finisher && (
              <span className="bg-orange-100 text-orange-600 text-xs font-bold px-3 py-1 rounded-full border border-orange-200">
                FINISHER
              </span>
            )}
          </div>

          {/* Punti e posizione */}
          <div className="flex gap-4 mb-4">
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-gray-900">{puntiTotali.toLocaleString('it-IT')}</div>
              <div className="text-xs text-gray-400 mt-0.5">punti {anno}</div>
            </div>
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-orange-500">#{posizione}</div>
              <div className="text-xs text-gray-400 mt-0.5">in classifica</div>
            </div>
          </div>

          {/* Barra progressione Finisher */}
          {!finisher && (
            <div>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>Progressione Finisher</span>
                <span>{puntiTotali.toLocaleString('it-IT')} / {sogliaFinisher.toLocaleString('it-IT')} pt</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div
                  className="bg-orange-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${progressione}%` }}
                />
              </div>
              <div className="text-xs text-gray-400 text-right mt-1">
                mancano {(sogliaFinisher - puntiTotali).toLocaleString('it-IT')} pt
              </div>
            </div>
          )}

          {finisher && (
            <div className="text-center text-sm text-orange-500 font-semibold mt-1">
              Soglia Finisher raggiunta! 🎉
            </div>
          )}
        </div>

        {/* Storico eventi — visibile all'atleta e all'admin */}
        {canSeeEvents && eventi && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {isMe ? 'I tuoi eventi' : 'Eventi'} ({eventi.length})
            </h2>
            {eventi.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                Nessun evento registrato ancora.{' '}
                <Link href="/registra" className="text-orange-500 hover:underline">Registra il primo →</Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {eventi.map((e, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
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
        )}

        {/* Messaggio se stai vedendo la scheda di un altro atleta senza permessi */}
        {!canSeeEvents && (
          <div className="text-center text-xs text-gray-400 mt-4">
            Lo storico eventi è visibile solo all'atleta stesso.
          </div>
        )}
      </div>
    </div>
  )
}

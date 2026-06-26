'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'

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
  atleta: { id: string; nome: string; categoria: string; numero_tessera: string | null; data_nascita: string | null }
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

  // Statistiche aggregate
  const eventiOrdinati = [...(eventi ?? [])].sort((a, b) => a.data.localeCompare(b.data))
  const kmTotali = Math.round(eventiOrdinati.reduce((s, e) => s + (e.completato ? e.km : e.km_effettivi ?? 0), 0))
  const dislivelloTotale = eventiOrdinati.reduce((s, e) => s + (e.dislivello_m ?? 0), 0)
  const eventiCompletati = eventiOrdinati.filter((e) => e.completato).length

  // Dati grafico punti cumulativi
  const puntiCumulativi: { data: string; punti: number }[] = []
  let acc = 0
  for (const e of eventiOrdinati) {
    acc += e.punti
    puntiCumulativi.push({ data: e.data, punti: acc })
  }

  // Ultima domenica di ottobre dell'anno corrente
  function ultimaDomenicaOttobre(y: number): Date {
    const d = new Date(y, 10, 0) // 31 ottobre
    d.setDate(d.getDate() - ((d.getDay() + 1) % 7)) // vai indietro fino a domenica
    return d
  }
  const scadenza = ultimaDomenicaOttobre(anno)
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const giorniRimasti = Math.max(0, Math.ceil((scadenza.getTime() - oggi.getTime()) / 86400000))
  const settimaneRimaste = giorniRimasti / 7
  const puntiMancanti = Math.max(0, sogliaFinisher - puntiTotali)
  const puntiSettimanaNecessari = settimaneRimaste > 0 ? Math.ceil(puntiMancanti / settimaneRimaste) : puntiMancanti

  function GraficoPunti() {
    if (puntiCumulativi.length < 1) return null
    const W = 320; const H = 100; const PAD = 10; const PAD_R = 48
    const maxP = Math.max(...puntiCumulativi.map((p) => p.punti), sogliaFinisher)
    const toX = (i: number) => PAD + (i / Math.max(puntiCumulativi.length - 1, 1)) * (W - PAD - PAD_R)
    const toY = (p: number) => H - PAD - (p / maxP) * (H - PAD * 2)

    const pts = puntiCumulativi.map((p, i) => `${toX(i)},${toY(p.punti)}`)
    const lastPt = pts[pts.length - 1].split(',')
    const sogliaNormY = toY(sogliaFinisher)
    const giaFinisher = puntiTotali >= sogliaFinisher

    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }}>
        {/* Linea soglia finisher */}
        <line x1={PAD} y1={sogliaNormY} x2={W - PAD_R + 4} y2={sogliaNormY}
          stroke={giaFinisher ? '#22c55e' : '#d1d5db'} strokeWidth="1.5" strokeDasharray="4 3" />
        <text x={W - PAD_R + 7} y={sogliaNormY + 4} fontSize="9" fill={giaFinisher ? '#22c55e' : '#9ca3af'} fontWeight="600">
          {(sogliaFinisher / 1000).toFixed(0)}K
        </text>

        {/* Area sotto la curva */}
        {puntiCumulativi.length > 1 && (
          <polygon
            points={`${toX(0)},${H - PAD} ${pts.join(' ')} ${toX(puntiCumulativi.length - 1)},${H - PAD}`}
            fill="rgba(255,85,0,0.08)"
          />
        )}

        {/* Linea punti */}
        <polyline points={pts.join(' ')} fill="none" stroke="#FF5500"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Punto finale */}
        <circle cx={lastPt[0]} cy={lastPt[1]} r="4" fill="#FF5500" />
      </svg>
    )
  }

  return (
    <PageShell title="" backHref="/classifica" backLabel="← Classifica">
      <div>

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
                {isMe && atleta.data_nascita && (
                  <span className="ml-2 text-gray-400">
                    · Nato/a il {new Date(atleta.data_nascita + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
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

          {/* Statistiche stagione */}
          {canSeeEvents && eventi && eventi.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Statistiche stagione</div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-gray-900">{kmTotali.toLocaleString('it-IT')}</div>
                  <div className="text-xs text-gray-400 mt-0.5">km totali</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-gray-900">{dislivelloTotale.toLocaleString('it-IT')}</div>
                  <div className="text-xs text-gray-400 mt-0.5">m dislivello</div>
                </div>
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-gray-900">{eventiCompletati}</div>
                  <div className="text-xs text-gray-400 mt-0.5">completati</div>
                </div>
              </div>

              {/* Grafico punti cumulativi */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-400">Andamento punti</span>
                  <span className="text-xs text-gray-400">
                    Finisher: <span className="font-semibold text-gray-600">{sogliaFinisher.toLocaleString('it-IT')} pt</span>
                  </span>
                </div>
                <GraficoPunti />
                {puntiCumulativi.length >= 2 && (
                  <div className="flex justify-between text-xs text-gray-300 mt-0.5 mb-3">
                    <span>{new Date(eventiOrdinati[0].data + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                    <span>{new Date(eventiOrdinati[eventiOrdinati.length - 1].data + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</span>
                  </div>
                )}

                {/* Info finisher */}
                {!finisher ? (
                  <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Punti mancanti</span>
                      <span className="font-bold text-orange-500">{puntiMancanti.toLocaleString('it-IT')} pt</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Ritmo necessario</span>
                      <span className="font-bold text-orange-500">{puntiSettimanaNecessari.toLocaleString('it-IT')} pt/settimana</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      Scadenza: {scadenza.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} · {giorniRimasti} giorni rimanenti
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-center text-sm font-semibold text-green-600">
                    Soglia Finisher raggiunta!
                  </div>
                )}
              </div>
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
    </PageShell>
  )
}

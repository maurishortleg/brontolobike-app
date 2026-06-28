'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'

// ── Tipi confronto ─────────────────────────────────────────────
type AtletaConfronto = { id: string; nome: string; mensile: Record<string, number>; trimestrale: Record<string, number> }
type AtletaMinimo = { id: string; nome: string }

const COLORI_CONFRONTO = ['#FF5500', '#0055CC', '#D8FF00']

function GraficoConfronto({ atleti, periodo }: { atleti: AtletaConfronto[]; periodo: 'mensile' | 'trimestrale' }) {
  const MESI_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
  const anno = new Date().getFullYear()

  let labels: string[]
  let getData: (a: AtletaConfronto, label: string) => number

  if (periodo === 'mensile') {
    labels = Array.from({ length: 12 }, (_, i) => `${anno}-${String(i + 1).padStart(2, '0')}`)
    getData = (a, l) => a.mensile[l] ?? 0
  } else {
    labels = ['Q1', 'Q2', 'Q3', 'Q4']
    getData = (a, l) => a.trimestrale[l] ?? 0
  }

  const maxVal = Math.max(...atleti.flatMap((a) => labels.map((l) => getData(a, l))), 1)
  const W = 320; const H = 160; const PAD_B = 24; const PAD_T = 8; const PAD_L = 8; const PAD_R = 8
  const barAreaW = W - PAD_L - PAD_R
  const gruppoW = barAreaW / labels.length
  const barW = Math.min(14, (gruppoW / atleti.length) - 2)
  const chartH = H - PAD_T - PAD_B

  const labelDisplay = periodo === 'mensile'
    ? (l: string) => MESI_IT[parseInt(l.slice(5, 7)) - 1]
    : (l: string) => l

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      {/* Griglia */}
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = PAD_T + chartH * (1 - f)
        return <line key={f} x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#f0f0f0" strokeWidth="1" />
      })}

      {labels.map((label, gi) => {
        const cx = PAD_L + gruppoW * gi + gruppoW / 2
        const totalBarW = barW * atleti.length + (atleti.length - 1) * 2
        return (
          <g key={label}>
            {atleti.map((a, ai) => {
              const val = getData(a, label)
              const barH = (val / maxVal) * chartH
              const x = cx - totalBarW / 2 + ai * (barW + 2)
              const y = PAD_T + chartH - barH
              return (
                <g key={a.id}>
                  <rect x={x} y={y} width={barW} height={Math.max(barH, 1)} fill={COLORI_CONFRONTO[ai]} rx="2" opacity={val === 0 ? 0.15 : 1} />
                  {val > 0 && barH > 14 && (
                    <text x={x + barW / 2} y={y + 10} textAnchor="middle" fontSize="7" fill="#fff" fontWeight="600">
                      {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                    </text>
                  )}
                </g>
              )
            })}
            <text x={cx} y={H - 6} textAnchor="middle" fontSize="8" fill="#9ca3af">
              {labelDisplay(label)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function SezioneConfronto({ atletaId, atletaNome, categoria }: { atletaId: string; atletaNome: string; categoria: string }) {
  const [periodo, setPeriodo] = useState<'mensile' | 'trimestrale'>('trimestrale')
  const [tuttiAtleti, setTuttiAtleti] = useState<AtletaMinimo[]>([])
  const [selezionati, setSelezionati] = useState<[string, string]>(['', ''])
  const [dati, setDati] = useState<AtletaConfronto[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/classifica?categoria=${categoria}`)
      .then((r) => r.json())
      .then((d) => {
        const lista: AtletaMinimo[] = (d.classifica ?? [])
          .filter((a: any) => a.id !== atletaId)
          .map((a: any) => ({ id: a.id, nome: a.nome }))
        setTuttiAtleti(lista)
      })
      .catch(() => {})
  }, [atletaId])

  const caricaConfronto = useCallback(async () => {
    const ids = [atletaId, ...selezionati.filter(Boolean)]
    if (ids.length < 2) return
    setLoading(true)
    try {
      const res = await fetch(`/api/atleta/confronto?ids=${ids.join(',')}`)
      const data = await res.json()
      setDati(data.atleti ?? null)
    } finally {
      setLoading(false)
    }
  }, [atletaId, selezionati])

  const atletiDaVisualizzare = dati ?? [{ id: atletaId, nome: atletaNome, mensile: {}, trimestrale: {} }]

  return (
    <div className="mt-4 pt-4 border-t border-gray-100">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Confronto atleti</div>

      {/* Legenda colori */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[atletaNome, selezionati[0], selezionati[1]].map((nome, i) => {
          if (!nome && i > 0) return null
          const label = nome ? tuttiAtleti.find((a) => a.id === nome)?.nome ?? (i === 0 ? nome : '') : ''
          const display = i === 0 ? atletaNome : label
          if (!display) return null
          return (
            <div key={i} className="flex items-center gap-1 text-xs text-gray-600">
              <span className="w-3 h-3 rounded-sm inline-block" style={{ background: COLORI_CONFRONTO[i] }} />
              <span>{display}</span>
            </div>
          )
        })}
      </div>

      {/* Selettori atleti */}
      <div className="flex flex-col gap-2 mb-3">
        {[0, 1].map((i) => (
          <select
            key={i}
            value={selezionati[i]}
            onChange={(e) => {
              const nuovo = [...selezionati] as [string, string]
              nuovo[i] = e.target.value
              setSelezionati(nuovo)
            }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-700 bg-white focus:outline-none focus:border-orange-400"
          >
            <option value="">— Atleta {i + 1} —</option>
            {tuttiAtleti
              .filter((a) => a.id !== selezionati[i === 0 ? 1 : 0])
              .map((a) => (
                <option key={a.id} value={a.id}>{a.nome}</option>
              ))}
          </select>
        ))}
      </div>

      {/* Toggle periodo */}
      <div className="flex gap-1 mb-3 bg-gray-100 rounded-lg p-1">
        {(['trimestrale', 'mensile'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors capitalize ${
              periodo === p ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Bottone confronta */}
      <button
        onClick={caricaConfronto}
        disabled={!selezionati[0] && !selezionati[1]}
        className="w-full text-sm font-semibold bg-orange-500 text-white rounded-xl py-2 mb-4 disabled:opacity-40 disabled:cursor-not-allowed active:bg-orange-600 transition-colors"
      >
        {loading ? 'Caricamento...' : 'Confronta'}
      </button>

      {/* Grafico */}
      {dati && (
        <GraficoConfronto atleti={atletiDaVisualizzare} periodo={periodo} />
      )}
    </div>
  )
}

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
  scadenza: string
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

  const { atleta, puntiTotali, posizione, finisher, progressione, sogliaFinisher, isMe, canSeeEvents, eventi, scadenza } = scheda
  const anno = new Date().getFullYear()
  const categoriaLabel = atleta.categoria === 'AMATORI' ? 'Amatori TEST' : 'Cicloturisti TEST'

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

  const scadenzaDate = new Date(scadenza + 'T12:00:00')
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  const giorniRimasti = Math.max(0, Math.ceil((scadenzaDate.getTime() - oggi.getTime()) / 86400000))
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
                      Scadenza: {scadenzaDate.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })} · {giorniRimasti} giorni rimanenti
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

        {/* Confronto atleti — solo per l'atleta stesso */}
        {isMe && (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-4">
            <SezioneConfronto atletaId={atleta.id} atletaNome={atleta.nome} categoria={atleta.categoria} />
          </div>
        )}

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

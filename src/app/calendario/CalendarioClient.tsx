'use client'

import { useState, useEffect } from 'react'
import Calendario from '@/app/registra/Calendario'
import Link from 'next/link'
import PageShell from '@/components/PageShell'

type Registrazione = {
  evento: string
  percorso: string
  km: number
  dislivello_m: number
  completato: boolean
  km_effettivi: number
  punti: number
}

type EventoCatalogo = {
  id: string
  nome: string
  data: string | null
  data_fine: string | null
  luogo: string | null
  tipologia: string | null
  url: string
  percorsi: { nome: string; km: number; dislivello: number | null; tipologia?: string | null }[]
  immagine_url?: string | null
}

type EventoLibero = {
  id: string
  nome: string
  tipologia: string | null
  url: string
  percorsi: { nome: string; km: number; dislivello: number | null }[]
  immagine_url?: string | null
  luogo: string | null
}

export default function CalendarioClient() {
  const [dataSelezionata, setDataSelezionata] = useState<string>('')
  const [registrazioni, setRegistrazioni] = useState<Registrazione[]>([])
  const [eventiCatalogo, setEventiCatalogo] = useState<EventoCatalogo[]>([])
  const [eventiLiberi, setEventiLiberi] = useState<EventoLibero[]>([])
  const [loading, setLoading] = useState(false)
  const [imgIngrandita, setImgIngrandita] = useState<string | null>(null)
  const [liberiAperti, setLiberiAperti] = useState(false)

  // Carica i percorsi liberi una sola volta (non dipendono dalla data)
  useEffect(() => {
    fetch('/api/eventi-per-data?data=2099-01-01')
      .then(r => r.json())
      .then(d => setEventiLiberi(d.liberi ?? []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!dataSelezionata) { setRegistrazioni([]); setEventiCatalogo([]); return }
    setLoading(true)
    Promise.all([
      fetch(`/api/calendario-club/giorno?data=${dataSelezionata}`).then((r) => r.json()),
      fetch(`/api/eventi-per-data?data=${dataSelezionata}`).then((r) => r.json()),
    ])
      .then(([club, catalogo]) => {
        setRegistrazioni(club.registrazioni ?? [])
        setEventiCatalogo(catalogo.risultati ?? [])
      })
      .catch(() => { setRegistrazioni([]); setEventiCatalogo([]) })
      .finally(() => setLoading(false))
  }, [dataSelezionata])

  const dataFormattata = dataSelezionata
    ? new Date(dataSelezionata + 'T12:00:00').toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <PageShell title="Il mio calendario">
      {/* Lightbox */}
      {imgIngrandita && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setImgIngrandita(null)}
        >
          <img
            src={imgIngrandita}
            alt="Locandina evento"
            className="max-w-full max-h-full rounded-xl shadow-2xl"
          />
        </div>
      )}
      <div>

        <Calendario
          onDataSelezionata={setDataSelezionata}
          dataSelezionata={dataSelezionata}
          apiPallini="/api/calendario-club"
        />

        {/* Banner percorsi liberi (sempre visibile) */}
        {eventiLiberi.length > 0 && (
          <div style={{
            margin: '12px 0',
            borderRadius: 12,
            border: '1px solid rgba(6,182,212,0.25)',
            background: 'rgba(6,182,212,0.05)',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setLiberiAperti(!liberiAperti)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13 }}>🔓</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#06b6d4' }}>
                  {eventiLiberi.length} percors{eventiLiberi.length === 1 ? 'o libero' : 'i liberi'} disponibili tutto l&apos;anno
                </span>
              </div>
              <span style={{ color: '#06b6d4', fontSize: 12, transition: 'transform 0.2s', transform: liberiAperti ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▾</span>
            </button>
            {liberiAperti && (
              <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <p style={{ fontSize: 11, color: 'rgba(6,182,212,0.7)', marginBottom: 8 }}>
                  Brevetti permanenti e percorsi con credenziale — nessuna data fissa, falli quando vuoi durante la stagione.
                </p>
                {eventiLiberi.map(ev => (
                  <div key={ev.id} style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: 'rgba(6,182,212,0.07)',
                    border: '1px solid rgba(6,182,212,0.15)',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginBottom: 2 }}>{ev.nome}</div>
                    {ev.tipologia && <div style={{ fontSize: 10, color: '#06b6d4', marginBottom: 4 }}>{ev.tipologia}</div>}
                    {ev.percorsi?.length > 0 && (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                        {ev.percorsi.map((p, i) => (
                          <span key={i}>{i > 0 ? ' · ' : ''}{p.km ? `${p.km} km` : p.nome}</span>
                        ))}
                      </div>
                    )}
                    {ev.url && (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 10, color: 'rgba(6,182,212,0.6)', marginTop: 4, display: 'block' }}>
                        Sito ufficiale →
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!dataSelezionata && (
          <p className="text-center text-sm text-gray-400 mt-4">
            Seleziona un giorno per vedere i tuoi eventi
          </p>
        )}

        {loading && (
          <div className="text-center text-sm text-gray-400 py-6">Caricamento...</div>
        )}

        {dataSelezionata && !loading && (
          <div className="mt-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize">
              {dataFormattata}
            </h2>

            {/* Le mie registrazioni */}
            {registrazioni.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-400 text-sm">
                Nessuna registrazione per questo giorno
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {registrazioni.map((r, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="font-semibold text-gray-900 mb-0.5">{r.evento}</div>
                    <div className="text-sm text-gray-500 mb-3">
                      {r.percorso} · {r.km} km · {r.dislivello_m} m ↑
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        {!r.completato && (
                          <span className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-full px-2 py-0.5">
                            parziale · {r.km_effettivi} km
                          </span>
                        )}
                      </div>
                      <span className="font-bold text-orange-500 text-lg">{r.punti} pt</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Eventi dal catalogo */}
            {eventiCatalogo.length > 0 && (
              <div className="mt-6">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Eventi in calendario
                </h3>
                <div className="flex flex-col gap-3">
                  {eventiCatalogo.map((ev) => (
                    <div key={ev.id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 text-sm">{ev.nome}</div>
                            {ev.luogo && (
                              <div className="text-xs text-gray-400 mt-0.5">{ev.luogo}</div>
                            )}
                            {ev.percorsi?.length > 0 && (
                              <div className="text-xs text-gray-500 mt-2 flex flex-col gap-1.5">
                                {ev.percorsi.map((p, i) => (
                                  <div key={i} className="flex flex-wrap items-center gap-1.5">
                                    <span className="font-medium text-gray-700">
                                      {p.nome !== 'Unico' && p.nome ? p.nome + ' · ' : ''}
                                      {p.km} km{p.dislivello ? ` / ${p.dislivello} m ↑` : ''}
                                    </span>
                                    {p.tipologia && (
                                      <span className="text-[10px] bg-orange-50 text-orange-600 border border-orange-100 rounded px-1.5 py-0.5 whitespace-nowrap">
                                        {p.tipologia}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {ev.immagine_url && (
                              <button onClick={() => setImgIngrandita(ev.immagine_url!)}>
                                <img
                                  src={ev.immagine_url}
                                  alt={ev.nome}
                                  className="w-16 h-16 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                />
                              </button>
                            )}
                          </div>
                        </div>
                        {ev.url && (
                          <a
                            href={ev.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 hover:underline mt-2 inline-block"
                          >
                            Sito ufficiale →
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  )
}

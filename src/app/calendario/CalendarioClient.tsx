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
  percorsi: { nome: string; km: number; dislivello: number | null }[]
  immagine_url?: string | null
}

export default function CalendarioClient() {
  const [dataSelezionata, setDataSelezionata] = useState<string>('')
  const [registrazioni, setRegistrazioni] = useState<Registrazione[]>([])
  const [eventiCatalogo, setEventiCatalogo] = useState<EventoCatalogo[]>([])
  const [loading, setLoading] = useState(false)
  const [imgIngrandita, setImgIngrandita] = useState<string | null>(null)

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
                              <div className="text-xs text-gray-500 mt-1">
                                {ev.percorsi.map((p, i) => (
                                  <span key={i}>
                                    {i > 0 && ' · '}
                                    {p.km} km{p.dislivello ? ` / ${p.dislivello} m ↑` : ''}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            {ev.tipologia && (
                              <span className="text-xs bg-orange-50 text-orange-600 border border-orange-100 rounded-full px-2 py-0.5 whitespace-nowrap">
                                {ev.tipologia}
                              </span>
                            )}
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

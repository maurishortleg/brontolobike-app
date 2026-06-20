'use client'

import { useState, useEffect } from 'react'
import Calendario from '@/app/registra/Calendario'
import Link from 'next/link'

type Registrazione = {
  evento: string
  percorso: string
  km: number
  dislivello_m: number
  completato: boolean
  km_effettivi: number
  punti: number
}

export default function CalendarioClient() {
  const [dataSelezionata, setDataSelezionata] = useState<string>('')
  const [registrazioni, setRegistrazioni] = useState<Registrazione[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!dataSelezionata) { setRegistrazioni([]); return }
    setLoading(true)
    fetch(`/api/calendario-club/giorno?data=${dataSelezionata}`)
      .then((r) => r.json())
      .then((d) => setRegistrazioni(d.registrazioni ?? []))
      .catch(() => setRegistrazioni([]))
      .finally(() => setLoading(false))
  }, [dataSelezionata])

  const dataFormattata = dataSelezionata
    ? new Date(dataSelezionata + 'T12:00:00').toLocaleDateString('it-IT', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      })
    : null

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Home</Link>
          <h1 className="text-2xl font-bold text-gray-800">Il mio calendario</h1>
        </div>

        <Calendario
          onDataSelezionata={setDataSelezionata}
          dataSelezionata={dataSelezionata}
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
          </div>
        )}
      </div>
    </div>
  )
}

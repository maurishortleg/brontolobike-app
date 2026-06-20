'use client'

import { useState, useEffect } from 'react'

type Props = {
  onDataSelezionata: (data: string) => void
  dataSelezionata: string | null
}

const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
const MESI = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
]

export default function Calendario({ onDataSelezionata, dataSelezionata }: Props) {
  const oggi = new Date()
  const [anno, setAnno] = useState(oggi.getFullYear())
  const [mese, setMese] = useState(oggi.getMonth()) // 0-based
  const [giorniConEventi, setGiorniConEventi] = useState<Set<string>>(new Set())

  const meseStr = `${anno}-${String(mese + 1).padStart(2, '0')}`

  useEffect(() => {
    fetch(`/api/eventi-calendario?mese=${meseStr}`)
      .then((r) => r.json())
      .then((d) => setGiorniConEventi(new Set(d.giorni ?? [])))
      .catch(() => setGiorniConEventi(new Set()))
  }, [meseStr])

  function mesePrecedente() {
    if (mese === 0) { setMese(11); setAnno(a => a - 1) }
    else setMese(m => m - 1)
  }

  function meseSuccessivo() {
    if (mese === 11) { setMese(0); setAnno(a => a + 1) }
    else setMese(m => m + 1)
  }

  // Costruisce la griglia del mese (celle vuote + giorni)
  function costruisciGriglia() {
    const primoGiorno = new Date(anno, mese, 1)
    const ultimoGiorno = new Date(anno, mese + 1, 0)
    // Lunedì = 0, Domenica = 6
    const offsetInizio = (primoGiorno.getDay() + 6) % 7
    const totaleDays = ultimoGiorno.getDate()

    const celle: (number | null)[] = [
      ...Array(offsetInizio).fill(null),
      ...Array.from({ length: totaleDays }, (_, i) => i + 1),
    ]
    // Padda a multiplo di 7
    while (celle.length % 7 !== 0) celle.push(null)
    return celle
  }

  const griglia = costruisciGriglia()
  const oggiStr = oggi.toISOString().split('T')[0]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      {/* Header mese */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={mesePrecedente}
          className="text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ‹
        </button>
        <span className="font-semibold text-gray-800 text-sm">
          {MESI[mese]} {anno}
        </span>
        <button
          onClick={meseSuccessivo}
          className="text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ›
        </button>
      </div>

      {/* Intestazione giorni */}
      <div className="grid grid-cols-7 mb-1">
        {GIORNI.map((g) => (
          <div key={g} className="text-center text-xs text-gray-400 font-medium py-1">
            {g}
          </div>
        ))}
      </div>

      {/* Griglia giorni */}
      <div className="grid grid-cols-7 gap-y-1">
        {griglia.map((giorno, i) => {
          if (!giorno) return <div key={i} />

          const dataStr = `${anno}-${String(mese + 1).padStart(2, '0')}-${String(giorno).padStart(2, '0')}`
          const isOggi = dataStr === oggiStr
          const isSelezionato = dataStr === dataSelezionata
          const haEventi = giorniConEventi.has(dataStr)

          return (
            <button
              key={i}
              onClick={() => onDataSelezionata(isSelezionato ? '' : dataStr)}
              className={`relative flex flex-col items-center justify-center h-9 w-full rounded-lg text-sm font-medium transition-colors
                ${isSelezionato ? 'bg-orange-500 text-white' : ''}
                ${isOggi && !isSelezionato ? 'border border-orange-400 text-orange-500' : ''}
                ${!isSelezionato && !isOggi ? 'text-gray-800 hover:bg-orange-50' : ''}
              `}
            >
              {giorno}
              {haEventi && (
                <span className={`absolute bottom-1 w-1 h-1 rounded-full ${isSelezionato ? 'bg-white' : 'bg-orange-400'}`} />
              )}
            </button>
          )
        })}
      </div>

      {dataSelezionata && (
        <button
          onClick={() => onDataSelezionata('')}
          className="mt-3 text-xs text-gray-400 hover:text-gray-600 w-full text-center"
        >
          × Rimuovi filtro data
        </button>
      )}
    </div>
  )
}

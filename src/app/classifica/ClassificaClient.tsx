'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type AtletaClassifica = {
  id: string
  nome: string
  punti: number
  puntiEntroScadenza: number
  finisher: boolean
}

type Campione = {
  id: string
  nome: string
  categoria: string
  punti: number
} | null

export default function ClassificaClient() {
  const [categoria, setCategoria] = useState<'Amatori' | 'Cicloturisti'>('Amatori')
  const [classifica, setClassifica] = useState<AtletaClassifica[]>([])
  const [campione, setCampione] = useState<Campione>(null)
  const [scadenza, setScadenza] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/campione-sociale')
      .then((r) => r.json())
      .then((d) => { setCampione(d.campione); setScadenza(d.scadenza) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/classifica?categoria=${categoria}`)
      .then((r) => r.json())
      .then((d) => setClassifica(d.classifica ?? []))
      .catch(() => setClassifica([]))
      .finally(() => setLoading(false))
  }, [categoria])

  const anno = new Date().getFullYear()
  const sogliaFinisher = categoria === 'Amatori' ? 9000 : 4000

  const scadenzaFormattata = scadenza
    ? new Date(scadenza + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">← Home</Link>
          <h1 className="text-2xl font-bold text-gray-800">Classifica {anno}</h1>
        </div>

        {/* Campione Sociale */}
        {campione && (
          <div className="bg-orange-500 text-white rounded-2xl p-4 mb-6 flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Campione Sociale {anno}</div>
              <div className="font-bold text-lg">{campione.nome}</div>
              <div className="text-sm opacity-90">{campione.punti} pt · {campione.categoria}</div>
            </div>
          </div>
        )}

        {!campione && scadenzaFormattata && (
          <div className="bg-white border border-gray-200 rounded-xl p-3 mb-6 text-sm text-gray-500 text-center">
            Il Campione Sociale sarà determinato al {scadenzaFormattata}
          </div>
        )}

        {/* Tab categorie */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 mb-4">
          {(['Amatori', 'Cicloturisti'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                categoria === cat
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="text-xs text-gray-400 text-right mb-2">
          FINISHER a {sogliaFinisher.toLocaleString('it-IT')} pt
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-10">Caricamento...</div>
        ) : classifica.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
            Nessun atleta in questa categoria
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {classifica.map((a, i) => (
              <div
                key={a.id}
                className={`bg-white rounded-xl border px-4 py-3 flex items-center gap-3 ${
                  a.finisher ? 'border-orange-300' : 'border-gray-200'
                }`}
              >
                <span className={`text-sm font-bold w-6 text-right ${i === 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{a.nome}</div>
                  {a.finisher && (
                    <span className="text-xs text-orange-600 font-semibold">FINISHER</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-gray-900">{a.punti.toLocaleString('it-IT')}</div>
                  <div className="text-xs text-gray-400">pt</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

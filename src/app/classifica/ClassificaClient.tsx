'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'

type AtletaClassifica = {
  id: string
  nome: string
  punti: number
  finisher: boolean
}

type Campione = {
  id: string
  nome: string
  categoria: string
  punti: number
} | null

type StagioneInfo = {
  anno: number
  attiva: boolean
}

export default function ClassificaClient() {
  const [categoria, setCategoria] = useState<'AMATORI' | 'CICLOTURISTI'>('AMATORI')
  const [anno, setAnno] = useState<number>(2027)
  const [stagioni, setStagioni] = useState<StagioneInfo[]>([])
  const [classifica, setClassifica] = useState<AtletaClassifica[]>([])
  const [campione, setCampione] = useState<Campione>(null)
  const [scadenza, setScadenza] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/campione-sociale?anno=${anno}`)
      .then((r) => r.json())
      .then((d) => { setCampione(d.campione); setScadenza(d.scadenza) })
      .catch(() => {})
  }, [anno])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/classifica?categoria=${categoria}&anno=${anno}`)
      .then((r) => r.json())
      .then((d) => {
        setClassifica(d.classifica ?? [])
        if (d.stagioni?.length) setStagioni(d.stagioni)
        if (d.anno) setAnno(d.anno)
      })
      .catch(() => setClassifica([]))
      .finally(() => setLoading(false))
  }, [categoria, anno])

  const sogliaFinisher = categoria === 'AMATORI' ? 9000 : 4000

  const scadenzaFormattata = scadenza
    ? new Date(scadenza + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const finishers = classifica.filter((a) => a.finisher)

  return (
    <PageShell title={`Classifica ${anno}`}>
      <div>

        {/* Selettore Stagione (es. 2027 Attiva / Archivio 2026) */}
        {stagioni.length > 1 && (
          <div className="flex gap-2 mb-4">
            {stagioni.map((s) => (
              <button
                key={s.anno}
                onClick={() => setAnno(s.anno)}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold uppercase tracking-wide border transition-colors ${
                  anno === s.anno
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-500 border-gray-200 hover:text-gray-800'
                }`}
              >
                {s.attiva ? `🚴 Stagione ${s.anno}` : `🏛️ Archivio ${s.anno}`}
              </button>
            ))}
          </div>
        )}

        {/* Campione Sociale — solo dopo l'ultima domenica di ottobre */}
        {campione && (
          <div className="bg-orange-500 text-white rounded-2xl p-4 mb-4 flex items-center gap-3">
            <span className="text-3xl">🏆</span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide opacity-80">Campione Sociale {anno}</div>
              <div className="font-bold text-lg">{campione.nome}</div>
              <div className="text-sm opacity-90">
                {campione.punti.toLocaleString('it-IT')} pt · {campione.categoria === 'AMATORI' ? 'Amatori' : 'Cicloturisti'}
              </div>
            </div>
          </div>
        )}

        {/* Banner Finisher — sempre visibile se ci sono finisher */}
        {finishers.length > 0 && (
          <div className="bg-white border border-orange-300 rounded-2xl p-4 mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-orange-500 mb-2">
              🎖️ Finisher {anno} — {categoria === 'AMATORI' ? 'Amatori' : 'Cicloturisti'} ({finishers.length})
            </div>
            <div className="flex flex-col gap-1">
              {finishers.map((a) => (
                <div key={a.id} className="flex justify-between text-sm">
                  <span className="font-medium text-gray-800">{a.nome}</span>
                  <span className="font-bold text-orange-500">{a.punti.toLocaleString('it-IT')} pt</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Info scadenza campione */}
        {!campione && scadenzaFormattata && (
          <div className="text-xs text-gray-400 text-center mb-4">
            Campione Sociale determinato al {scadenzaFormattata}
          </div>
        )}

        {/* Tab categorie */}
        <div className="flex bg-white border border-gray-200 rounded-xl p-1 mb-4">
          {(['AMATORI', 'CICLOTURISTI'] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                categoria === cat
                  ? 'bg-orange-500 text-white'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {cat === 'AMATORI' ? 'Amatori' : 'Cicloturisti'}
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
                <span className={`text-sm font-bold w-6 text-right shrink-0 ${i === 0 && a.punti > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <Link href={`/atleta/${a.id}`} className="font-medium text-gray-900 hover:text-orange-500 truncate block">
                    {a.nome}
                  </Link>
                  {a.finisher && (
                    <span className="text-xs text-orange-600 font-semibold">FINISHER</span>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-gray-900">{a.punti.toLocaleString('it-IT')}</div>
                  <div className="text-xs text-gray-400">pt</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}

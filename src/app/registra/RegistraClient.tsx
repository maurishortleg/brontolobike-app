'use client'

import { useState, useEffect } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { calcolaPunteggio } from '@/lib/punteggio'
import { useRouter } from 'next/navigation'

type Tipologia = {
  id: number
  nome: string
  coefficiente_km: number
  punti_fissi: number | null
  ignora_km_dislivello: boolean
}

type Percorso = {
  nome_percorso: string
  tipologia_id: number | ''
  km: string
  dislivello_m: string
}

export default function RegistraClient({
  tipologie,
  atletaIdServer,
  stagione_id,
}: {
  tipologie: Tipologia[]
  atletaIdServer: string | null
  stagione_id: number
}) {
  const supabase = createSupabaseBrowserClient()
  const router = useRouter()

  const [atletaId, setAtletaId] = useState<string | null>(atletaIdServer)
  const [nomeEvento, setNomeEvento] = useState('')
  const [dataEvento, setDataEvento] = useState('')
  const [percorsi, setPercorsi] = useState<Percorso[]>([
    { nome_percorso: '', tipologia_id: '', km: '', dislivello_m: '' },
  ])
  const [percorsoSelezionato, setPercorsoSelezionato] = useState(0)
  const [completato, setCompletato] = useState(true)
  const [kmEffettivi, setKmEffettivi] = useState('')
  const [dislivelloEff, setDislivelloEff] = useState('')
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')
  const [successo, setSuccesso] = useState<number | null>(null)

  useEffect(() => {
    if (!atletaIdServer) {
      const stored = localStorage.getItem('atleta_selezionato')
      if (stored) setAtletaId(JSON.parse(stored).id)
    }
  }, [atletaIdServer])

  function aggiornaPercorso(idx: number, campo: keyof Percorso, valore: string | number) {
    setPercorsi((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, [campo]: valore } : p))
    )
  }

  function aggiungiPercorso() {
    setPercorsi((prev) => [
      ...prev,
      { nome_percorso: '', tipologia_id: '', km: '', dislivello_m: '' },
    ])
  }

  function rimuoviPercorso(idx: number) {
    if (percorsi.length === 1) return
    setPercorsi((prev) => prev.filter((_, i) => i !== idx))
    setPercorsoSelezionato((prev) => Math.min(prev, percorsi.length - 2))
  }

  function getTipologia(id: number | ''): Tipologia | null {
    return tipologie.find((t) => t.id === id) ?? null
  }

  function calcolaAnteprima(): number | null {
    const p = percorsi[percorsoSelezionato]
    const tip = getTipologia(p.tipologia_id)
    if (!tip) return null
    const km = completato ? parseFloat(p.km) : parseFloat(kmEffettivi)
    const dislivello = completato ? parseInt(p.dislivello_m) : parseInt(dislivelloEff)
    if (isNaN(km) || isNaN(dislivello)) return null
    return calcolaPunteggio(tip, km, dislivello)
  }

  function resetForm() {
    setSuccesso(null)
    setNomeEvento('')
    setDataEvento('')
    setPercorsi([{ nome_percorso: '', tipologia_id: '', km: '', dislivello_m: '' }])
    setPercorsoSelezionato(0)
    setCompletato(true)
    setKmEffettivi('')
    setDislivelloEff('')
  }

  async function salva() {
    setErrore('')
    if (!atletaId) { setErrore('Nessun atleta selezionato. Torna alla home e accedi.'); return }
    if (!nomeEvento.trim()) { setErrore("Inserisci il nome dell'evento."); return }
    if (!dataEvento) { setErrore('Inserisci la data.'); return }

    const p = percorsi[percorsoSelezionato]
    if (!p.tipologia_id) { setErrore('Seleziona la tipologia per il percorso scelto.'); return }
    if (!p.km || !p.dislivello_m) { setErrore('Inserisci km e dislivello del percorso scelto.'); return }
    if (!completato && (!kmEffettivi || !dislivelloEff)) {
      setErrore('Inserisci i km e il dislivello effettivamente percorsi.'); return
    }

    const punti = calcolaAnteprima()
    if (punti === null) { setErrore('Dati non validi per il calcolo del punteggio.'); return }

    setLoading(true)

    const { data: evento, error: errEvento } = await supabase
      .from('eventi')
      .insert({ nome: nomeEvento.trim(), data_evento: dataEvento, stagione_id })
      .select('id')
      .single()
    if (errEvento) { setErrore('Errore nel salvataggio evento.'); setLoading(false); return }

    const percorsiData = percorsi.map((pc) => ({
      evento_id: evento.id,
      nome_percorso: pc.nome_percorso.trim() || 'Percorso',
      km: parseFloat(pc.km) || 0,
      dislivello_m: parseInt(pc.dislivello_m) || 0,
    }))
    const { data: percorsiCreati, error: errPercorsi } = await supabase
      .from('percorsi')
      .insert(percorsiData)
      .select('id')
    if (errPercorsi) { setErrore('Errore nel salvataggio percorsi.'); setLoading(false); return }

    const percorsoId = percorsiCreati[percorsoSelezionato].id
    const kmEff = completato ? parseFloat(p.km) : parseFloat(kmEffettivi)
    const dislivEff = completato ? parseInt(p.dislivello_m) : parseInt(dislivelloEff)

    const { error: errReg } = await supabase.from('registrazioni').insert({
      atleta_id: atletaId,
      percorso_id: percorsoId,
      stagione_id,
      completato,
      km_effettivi: kmEff,
      dislivello_eff: dislivEff,
      punti,
    })
    if (errReg) { setErrore('Errore nel salvataggio registrazione.'); setLoading(false); return }

    setSuccesso(punti)
    setLoading(false)
  }

  if (successo !== null) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow p-8 text-center max-w-sm w-full">
          <div className="text-6xl font-extrabold text-orange-500 mb-1">{successo}</div>
          <div className="text-gray-500 mb-6">punti assegnati</div>
          <button
            onClick={resetForm}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition-colors mb-3"
          >
            Registra un altro evento
          </button>
          <button onClick={() => router.push('/')} className="text-sm text-gray-400 hover:underline">
            Torna alla home
          </button>
        </div>
      </div>
    )
  }

  const anteprima = calcolaAnteprima()

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Registra evento</h1>

        {errore && <p className="text-red-500 text-sm mb-4 bg-red-50 rounded-lg p-3">{errore}</p>}

        {/* Nome evento */}
        <label className="block text-sm font-medium text-gray-700 mb-1">Nome evento</label>
        <input
          type="text"
          value={nomeEvento}
          onChange={(e) => setNomeEvento(e.target.value)}
          placeholder="Es. Granfondo Pinarello"
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />

        {/* Data */}
        <label className="block text-sm font-medium text-gray-700 mb-1">Data evento</label>
        <input
          type="date"
          value={dataEvento}
          onChange={(e) => setDataEvento(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />

        {/* Percorsi */}
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Percorsi disponibili
          </label>
          <button
            type="button"
            onClick={aggiungiPercorso}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium"
          >
            + Aggiungi percorso
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Seleziona il percorso che hai fatto con il radio button.
        </p>

        <div className="flex flex-col gap-3 mb-6">
          {percorsi.map((p, idx) => {
            const tip = getTipologia(p.tipologia_id)
            const isSelected = percorsoSelezionato === idx
            return (
              <div
                key={idx}
                className={`rounded-xl border-2 p-4 transition-colors cursor-pointer ${
                  isSelected ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white'
                }`}
                onClick={() => setPercorsoSelezionato(idx)}
              >
                {/* Header percorso */}
                <div className="flex items-center gap-3 mb-3">
                  <input
                    type="radio"
                    checked={isSelected}
                    onChange={() => setPercorsoSelezionato(idx)}
                    onClick={(e) => e.stopPropagation()}
                    className="accent-orange-500 w-4 h-4 shrink-0"
                  />
                  <input
                    type="text"
                    value={p.nome_percorso}
                    onChange={(e) => { e.stopPropagation(); aggiornaPercorso(idx, 'nome_percorso', e.target.value) }}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Nome percorso (es. Lungo Gravel, Medio Strada…)"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white"
                  />
                  {percorsi.length > 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); rimuoviPercorso(idx) }}
                      className="text-red-400 hover:text-red-600 text-xs shrink-0"
                    >
                      Rimuovi
                    </button>
                  )}
                </div>

                {/* Km e Dislivello in evidenza */}
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-white rounded-lg border border-gray-200 p-3 text-center">
                    <input
                      type="number"
                      value={p.km}
                      onChange={(e) => { e.stopPropagation(); aggiornaPercorso(idx, 'km', e.target.value) }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="0"
                      min="0"
                      step="0.1"
                      className="w-full text-2xl font-bold text-center text-gray-800 focus:outline-none bg-transparent"
                    />
                    <span className="text-xs text-gray-400 font-medium">km</span>
                  </div>
                  <div className="flex-1 bg-white rounded-lg border border-gray-200 p-3 text-center">
                    <input
                      type="number"
                      value={p.dislivello_m}
                      onChange={(e) => { e.stopPropagation(); aggiornaPercorso(idx, 'dislivello_m', e.target.value) }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="0"
                      min="0"
                      className="w-full text-2xl font-bold text-center text-gray-800 focus:outline-none bg-transparent"
                    />
                    <span className="text-xs text-gray-400 font-medium">m dislivello</span>
                  </div>
                </div>

                {/* Tipologia per percorso */}
                <select
                  value={p.tipologia_id}
                  onChange={(e) => { e.stopPropagation(); aggiornaPercorso(idx, 'tipologia_id', Number(e.target.value)) }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white text-gray-700"
                >
                  <option value="">Tipologia evento...</option>
                  {tipologie.map((t) => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>

                {/* Anteprima punti per questo percorso */}
                {tip && p.km && p.dislivello_m && (
                  <div className="mt-2 text-right text-xs text-orange-500 font-medium">
                    {calcolaPunteggio(tip, parseFloat(p.km), parseInt(p.dislivello_m))} punti
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Completato */}
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Hai completato il percorso selezionato?
        </label>
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={() => setCompletato(true)}
            className={`flex-1 py-2 rounded-lg border font-medium text-sm transition-colors ${
              completato ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            Sì, completato
          </button>
          <button
            type="button"
            onClick={() => setCompletato(false)}
            className={`flex-1 py-2 rounded-lg border font-medium text-sm transition-colors ${
              !completato ? 'bg-orange-500 text-white border-orange-500' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            No, parziale
          </button>
        </div>

        {/* Km effettivi per parziale */}
        {!completato && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
            <p className="text-sm text-yellow-800 mb-3">
              Inserisci km e dislivello effettivamente percorsi:
            </p>
            <div className="flex gap-3">
              <div className="flex-1 bg-white rounded-lg border border-yellow-200 p-3 text-center">
                <input
                  type="number"
                  value={kmEffettivi}
                  onChange={(e) => setKmEffettivi(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.1"
                  className="w-full text-2xl font-bold text-center text-gray-800 focus:outline-none bg-transparent"
                />
                <span className="text-xs text-gray-400 font-medium">km effettivi</span>
              </div>
              <div className="flex-1 bg-white rounded-lg border border-yellow-200 p-3 text-center">
                <input
                  type="number"
                  value={dislivelloEff}
                  onChange={(e) => setDislivelloEff(e.target.value)}
                  placeholder="0"
                  min="0"
                  className="w-full text-2xl font-bold text-center text-gray-800 focus:outline-none bg-transparent"
                />
                <span className="text-xs text-gray-400 font-medium">m dislivello eff.</span>
              </div>
            </div>
          </div>
        )}

        {/* Anteprima punteggio finale */}
        {anteprima !== null && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4 text-center">
            <span className="text-sm text-gray-500">Punteggio che verrà assegnato: </span>
            <span className="text-3xl font-extrabold text-orange-500"> {anteprima}</span>
            <span className="text-gray-500"> punti</span>
          </div>
        )}

        <button
          onClick={salva}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? 'Salvataggio...' : 'Registra evento'}
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useRef } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import { calcolaPunteggio } from '@/lib/punteggio'
import { useRouter } from 'next/navigation'
import Calendario from './Calendario'

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

type PercorsoTrovato = {
  nome: string
  km: number
  dislivello: number | null
  tipologia: string | null
}

type EventoTrovato = {
  nome: string
  data: string | null
  data_fine: string | null
  luogo: string | null
  tipologia: string | null
  url: string
  percorsi: PercorsoTrovato[]
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

  // --- Search phase state ---
  const [fase, setFase] = useState<'cerca' | 'form'>('cerca')
  const [queryRicerca, setQueryRicerca] = useState('')
  const [loadingRicerca, setLoadingRicerca] = useState(false)
  const [risultatiRicerca, setRisultatiRicerca] = useState<EventoTrovato[]>([])
  const [suggerimenti, setSuggerimenti] = useState<EventoTrovato[]>([])
  const [mostraSuggerimenti, setMostraSuggerimenti] = useState(false)
  const [erroreRicerca, setErroreRicerca] = useState('')
  const [dataFiltro, setDataFiltro] = useState<string>('')
  const [eventiDelGiorno, setEventiDelGiorno] = useState<EventoTrovato[]>([])
  const [loadingGiorno, setLoadingGiorno] = useState(false)
  const autocompleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Form state ---
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
  const [urlEvento, setUrlEvento] = useState('')
  const [loading, setLoading] = useState(false)
  const [errore, setErrore] = useState('')
  const [successo, setSuccesso] = useState<number | null>(null)

  useEffect(() => {
    if (!atletaIdServer) {
      const stored = localStorage.getItem('atleta_selezionato')
      if (stored) setAtletaId(JSON.parse(stored).id)
    }
  }, [atletaIdServer])

  // Autocomplete dal DB mentre l'utente digita
  function onQueryChange(val: string) {
    setQueryRicerca(val)
    setRisultatiRicerca([])
    setErroreRicerca('')

    if (autocompleteTimer.current) clearTimeout(autocompleteTimer.current)

    if (val.trim().length < 2) {
      setSuggerimenti([])
      setMostraSuggerimenti(false)
      return
    }

    autocompleteTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/eventi-db?q=${encodeURIComponent(val.trim())}`)
        const data = await res.json()
        setSuggerimenti(data.risultati ?? [])
        setMostraSuggerimenti((data.risultati ?? []).length > 0)
      } catch {
        setSuggerimenti([])
      }
    }, 300)
  }

  // Cerca con AI (Tavily + Gemini)
  async function cercaConAI() {
    if (!queryRicerca.trim()) return
    setMostraSuggerimenti(false)
    setLoadingRicerca(true)
    setErroreRicerca('')
    setRisultatiRicerca([])
    try {
      const res = await fetch('/api/cerca-evento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryRicerca }),
      })
      const data = await res.json()
      const trovati: EventoTrovato[] = data.risultati ?? []
      setRisultatiRicerca(trovati)
      if (trovati.length === 0) {
        setErroreRicerca('Nessun evento trovato. Puoi inserire i dati manualmente.')
      }
    } catch {
      setErroreRicerca('Errore nella ricerca. Inserisci i dati manualmente.')
    } finally {
      setLoadingRicerca(false)
    }
  }

  function correggiRandonnee(tipologia: string | null, km: number | null): string | null {
    if (!tipologia) return tipologia
    if (!tipologia.toLowerCase().includes('randonn')) return tipologia
    if (km == null) return tipologia
    return km <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
  }

  function trovaTipologiaId(nomeTipologia: string | null, km?: number | null): number | '' {
    const nome = correggiRandonnee(nomeTipologia, km ?? null)
    if (!nome) return ''
    const match = tipologie.find((t) => t.nome.toLowerCase() === nome.toLowerCase())
    return match ? match.id : ''
  }

  function selezionaEvento(ev: EventoTrovato, percorsoScelto?: PercorsoTrovato) {
    setMostraSuggerimenti(false)
    setNomeEvento(ev.nome)
    if (ev.data) setDataEvento(ev.data)
    setUrlEvento(ev.url ?? '')

    const tipologiaEventoId = trovaTipologiaId(ev.tipologia)

    const percorsiPrecompilati: Percorso[] = ev.percorsi?.length > 0
      ? ev.percorsi.map((p) => ({
          nome_percorso: p.nome,
          tipologia_id: trovaTipologiaId(p.tipologia ?? ev.tipologia, p.km) || tipologiaEventoId,
          km: String(p.km),
          dislivello_m: p.dislivello != null ? String(p.dislivello) : '',
        }))
      : [{ nome_percorso: '', tipologia_id: tipologiaEventoId, km: '', dislivello_m: '' }]

    setPercorsi(percorsiPrecompilati)

    // Se l'utente ha cliccato un percorso specifico, mostra solo quello nel form
    if (percorsoScelto) {
      const soloPercorso: Percorso = {
        nome_percorso: percorsoScelto.nome,
        tipologia_id: trovaTipologiaId(percorsoScelto.tipologia ?? ev.tipologia, percorsoScelto.km) || tipologiaEventoId,
        km: String(percorsoScelto.km),
        dislivello_m: percorsoScelto.dislivello != null ? String(percorsoScelto.dislivello) : '',
      }
      setPercorsi([soloPercorso])
      setPercorsoSelezionato(0)
    } else {
      setPercorsoSelezionato(0)
    }

    setFase('form')
  }

  function vaiAlForm() {
    setMostraSuggerimenti(false)
    if (queryRicerca.trim() && nomeEvento === '') setNomeEvento(queryRicerca)
    setFase('form')
  }

  // --- Form logic ---
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

  async function onDataCalendario(data: string) {
    setDataFiltro(data)
    setRisultatiRicerca([])
    setErroreRicerca('')
    if (!data) { setEventiDelGiorno([]); return }
    setLoadingGiorno(true)
    try {
      const res = await fetch(`/api/eventi-per-data?data=${data}`)
      const d = await res.json()
      setEventiDelGiorno(d.risultati ?? [])
      if ((d.risultati ?? []).length === 0) {
        setErroreRicerca(`Nessun evento trovato per il ${new Date(data + 'T12:00:00').toLocaleDateString('it-IT')}. Cerca per nome o inserisci manualmente.`)
      }
    } catch {
      setEventiDelGiorno([])
    } finally {
      setLoadingGiorno(false)
    }
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
    setQueryRicerca('')
    setRisultatiRicerca([])
    setSuggerimenti([])
    setErroreRicerca('')
    setDataFiltro('')
    setEventiDelGiorno([])
    setUrlEvento('')
    setFase('cerca')
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
      .insert({ nome: nomeEvento.trim(), data_evento: dataEvento, stagione_id, url: urlEvento || null })
      .select('id')
      .single()
    if (errEvento) { setErrore('Errore nel salvataggio evento.'); setLoading(false); return }

    const percorsiData = percorsi.map((pc) => ({
      evento_id: evento.id,
      nome_percorso: pc.nome_percorso.trim() || 'Percorso',
      km: parseFloat(pc.km) || 0,
      dislivello_m: parseInt(pc.dislivello_m) || 0,
      tipologia_id: pc.tipologia_id || null,
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

  // --- Success screen ---
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

  // --- Search phase ---
  if (fase === 'cerca') {
    const listaVisibile = dataFiltro
      ? eventiDelGiorno
      : risultatiRicerca

    return (
      <div className="min-h-screen flex flex-col">
        <div className="bb-stripe w-full h-2 shrink-0" />
        <div className="flex-1 py-8 px-4">
        <div className="max-w-lg mx-auto bg-white rounded-2xl shadow p-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Registra evento</h1>
          <p className="text-sm text-gray-500 mb-4">
            Cerca per nome o seleziona una data nel calendario
          </p>

          {/* Calendario */}
          <Calendario
            onDataSelezionata={onDataCalendario}
            dataSelezionata={dataFiltro}
          />

          {/* Search bar con autocomplete */}
          <div className="relative mb-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={queryRicerca}
                  onChange={(e) => onQueryChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { setMostraSuggerimenti(false); cercaConAI() }
                    if (e.key === 'Escape') setMostraSuggerimenti(false)
                  }}
                  onBlur={() => setTimeout(() => setMostraSuggerimenti(false), 150)}
                  onFocus={() => suggerimenti.length > 0 && setMostraSuggerimenti(true)}
                  placeholder="Es. Greenlands Varese 2026"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-900"
                  autoFocus
                />
                {/* Dropdown autocomplete dal DB */}
                {mostraSuggerimenti && suggerimenti.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
                    {suggerimenti.map((ev, i) => (
                      <div key={i} className="border-b border-gray-100 last:border-0">
                        <div className="px-4 pt-3 pb-1">
                          <div className="font-medium text-gray-900 text-sm">{ev.nome}</div>
                          <div className="text-xs text-gray-700 mt-0.5">
                            {ev.data && new Date(ev.data).toLocaleDateString('it-IT')}
                            {ev.luogo && ` · 📍 ${ev.luogo}`}
                            {ev.tipologia && ` · ${ev.tipologia}`}
                          </div>
                        </div>
                        {ev.percorsi?.length > 0 ? (
                          <div className="px-4 pb-2 flex flex-col gap-1">
                            {ev.percorsi.map((p, j) => (
                              <button
                                key={j}
                                onMouseDown={() => selezionaEvento(ev, p)}
                                className="text-left flex items-center justify-between hover:bg-orange-50 rounded-lg px-2 py-1.5 transition-colors"
                              >
                                <span className="text-sm text-gray-900">{p.nome}</span>
                                <span className="text-xs text-gray-700 flex gap-2">
                                  <span>{p.km} km</span>
                                  {p.dislivello != null && <span>{p.dislivello} m ↑</span>}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button
                            onMouseDown={() => selezionaEvento(ev)}
                            className="w-full text-left px-4 pb-3 text-xs text-orange-500"
                          >
                            Seleziona →
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={cercaConAI}
                disabled={loadingRicerca || !queryRicerca.trim()}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {loadingRicerca ? '...' : 'Cerca'}
              </button>
            </div>
            {queryRicerca.length >= 2 && !mostraSuggerimenti && !loadingRicerca && risultatiRicerca.length === 0 && !erroreRicerca && (
              <p className="text-xs text-gray-400 mt-1.5">
                Premi <strong>Cerca</strong> per cercare online con AI
              </p>
            )}
          </div>

          {/* Loading indicators */}
          {(loadingRicerca || loadingGiorno) && (
            <div className="text-center py-6 text-gray-400 text-sm">
              {loadingRicerca ? 'Ricerca in corso con AI...' : 'Caricamento eventi...'}
            </div>
          )}

          {/* Error/empty */}
          {erroreRicerca && !loadingRicerca && (
            <p className="text-sm text-gray-500 mb-4 bg-gray-50 rounded-lg p-3">
              {erroreRicerca}
            </p>
          )}

          {/* Results from AI */}
          {listaVisibile.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">
                Risultati trovati — clicca per selezionare
              </p>
              <div className="flex flex-col gap-2">
                {listaVisibile.map((ev, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-xl p-4"
                  >
                    <div className="font-semibold text-gray-900 mb-0.5 leading-tight">{ev.nome}</div>
                    <div className="text-sm text-gray-700 flex flex-wrap gap-3 mb-3">
                      {ev.data && (
                        <span>
                          {new Date(ev.data + 'T12:00:00').toLocaleDateString('it-IT')}
                          {ev.data_fine && ` → ${new Date(ev.data_fine + 'T12:00:00').toLocaleDateString('it-IT')}`}
                        </span>
                      )}
                      {ev.luogo && <span>📍 {ev.luogo}</span>}
                      {(() => {
                        // Non mostrare la tipologia se i percorsi hanno etichette Randonnée miste
                        const tipPercorsi = [...new Set(ev.percorsi?.map((p) => correggiRandonnee(p.tipologia ?? ev.tipologia, p.km)).filter(Boolean))]
                        const hasMixedRandonnee = tipPercorsi.filter((t) => t?.toLowerCase().includes('randonn')).length > 1
                        if (hasMixedRandonnee) return null
                        return ev.tipologia ? <span className="text-orange-500 font-medium">{ev.tipologia}</span> : null
                      })()}
                    </div>

                    {ev.percorsi?.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-gray-400 font-medium">Scegli il tuo percorso:</p>
                        {ev.percorsi.map((p, j) => (
                          <button
                            key={j}
                            onClick={() => selezionaEvento(ev, p)}
                            className="text-left flex items-center justify-between bg-gray-50 hover:bg-orange-50 hover:border-orange-400 border border-gray-200 rounded-lg px-3 py-2.5 transition-colors"
                          >
                            <span className="font-medium text-gray-900 text-sm">{p.nome}</span>
                            <span className="text-xs text-gray-700 flex gap-2">
                              <span>{p.km} km</span>
                              {p.dislivello != null && <span>{p.dislivello} m ↑</span>}
                            </span>
                          </button>
                        ))}
                        <button
                          onClick={() => selezionaEvento(ev)}
                          className="text-xs text-gray-400 hover:text-gray-600 text-left mt-1"
                        >
                          Vedi tutti i percorsi nel form →
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => selezionaEvento(ev)}
                        className="text-sm text-orange-500 font-medium hover:underline"
                      >
                        Seleziona evento →
                      </button>
                    )}
                  </div>
                ))}
            </div>
            </div>
          )}

          {/* Manual fallback */}
          <button
            onClick={vaiAlForm}
            className="text-sm text-orange-500 hover:text-orange-600 font-medium mt-2 hover:underline"
          >
            Inserisci manualmente →
          </button>
        </div>
      </div>
      </div>
    )
  }

  // --- Form phase ---
  const anteprima = calcolaAnteprima()

  return (
    <div className="min-h-screen flex flex-col">
      <div className="bb-stripe w-full h-2 shrink-0" />
      <div className="flex-1 py-8 px-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setFase('cerca')}
            className="text-gray-400 hover:text-gray-600 text-sm"
          >
            ← Cerca
          </button>
          <h1 className="text-2xl font-bold text-gray-800">Registra evento</h1>
        </div>

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
          <label className="text-sm font-medium text-gray-700">Percorsi disponibili</label>
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
                    placeholder="Nome percorso"
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
    </div>
  )
}

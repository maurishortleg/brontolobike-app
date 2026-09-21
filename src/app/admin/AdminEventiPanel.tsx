"use client"

import { useState, useEffect, useCallback } from "react"

type Tipologia = { id: number; nome: string }

type Percorso = {
  id: number
  nome_percorso: string
  km: number | null
  dislivello_m: number | null
  tipologia_id: number | null
  tipologie_evento?: { nome: string } | null
}

type Evento = {
  id: number
  nome: string
  data_evento: string | null
  data_fine: string | null
  tipologia: string | null
  luogo: string | null
  url: string | null
  stato: string
  attivo: boolean
}

const STATI = ["ricercato", "confermato"]

export default function AdminEventiPanel() {
  const [query, setQuery] = useState("")
  const [eventi, setEventi] = useState<Evento[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [eventoAperto, setEventoAperto] = useState<number | null>(null)
  const [percorsiMap, setPercorsiMap] = useState<Record<number, Percorso[]>>({})
  const [editEvento, setEditEvento] = useState<Partial<Evento>>({})
  const [editPercorso, setEditPercorso] = useState<Record<number, Partial<Percorso>>>({})
  const [nuovoPercorso, setNuovoPercorso] = useState<Partial<Percorso> & { evento_id?: number }>({})
  const [aggiungiPercorsoId, setAggiungiPercorsoId] = useState<number | null>(null)
  const [tipologie, setTipologie] = useState<Tipologia[]>([])
  const [msg, setMsg] = useState("")
  const LIMIT = 20

  useEffect(() => {
    fetch("/api/classifica")
      .then((r) => r.json())
      .then(() => {})
    fetch("/api/admin/atleti").then(() => {})
    // Carica tipologie
    fetch("/api/cerca-evento")
      .then(() => {})
    // Fetch tipologie direttamente
    loadTipologie()
  }, [])

  async function loadTipologie() {
    try {
      const r = await fetch("/api/admin/eventi?id=1")
      // tipologie non in questa API - uso hardcoded da classifica-tipologia
    } catch {}
    // Fetch tipologie via supabase pubblico - endpoint non esiste ancora, uso lista hardcoded
    setTipologie([
      { id: 1, nome: "Gran/Medio Fondo" }, { id: 2, nome: "Randonnee fino a 120Km" },
      { id: 3, nome: "Randonnee oltre i 120Km" }, { id: 4, nome: "Pedalata Cicloturistica" },
      { id: 5, nome: "Brevetto Permanente Strada" }, { id: 6, nome: "Brevetto Permanente Gravel" },
      { id: 7, nome: "Percorso con Credenziale" }, { id: 8, nome: "Ciclocross" },
      { id: 9, nome: "MTB" }, { id: 10, nome: "Gravel" }, { id: 11, nome: "Gara in Circuito (CRIT)" },
      { id: 12, nome: "Gravel di GRAvellAND" }, { id: 13, nome: "Trail" },
      { id: 14, nome: "Brontolo Bike Day" }, { id: 15, nome: "Uva Fragola" },
      { id: 16, nome: "Bike Camp Livigno" },
    ])
  }

  const cerca = useCallback(async (q: string, pg: number) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/eventi?q=${encodeURIComponent(q)}&page=${pg}&limit=${LIMIT}`)
      const d = await r.json()
      setEventi(d.eventi ?? [])
      setTotal(d.total ?? 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => { cerca(query, page) }, 350)
    return () => clearTimeout(t)
  }, [query, page, cerca])

  async function apriEvento(ev: Evento) {
    if (eventoAperto === ev.id) { setEventoAperto(null); return }
    setEventoAperto(ev.id)
    setEditEvento({ ...ev })
    if (!percorsiMap[ev.id]) {
      const r = await fetch(`/api/admin/eventi?id=${ev.id}`)
      const d = await r.json()
      setPercorsiMap((prev) => ({ ...prev, [ev.id]: d.percorsi ?? [] }))
    }
  }

  async function salvaEvento(id: number) {
    const r = await fetch("/api/admin/eventi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editEvento }),
    })
    if (r.ok) {
      setEventi((prev) => prev.map((e) => e.id === id ? { ...e, ...editEvento } as Evento : e))
      flash("Evento salvato ✓")
    } else {
      const d = await r.json()
      flash("Errore: " + d.error)
    }
  }

  async function eliminaEvento(id: number) {
    if (!confirm("Eliminare questo evento e tutti i suoi percorsi?")) return
    const r = await fetch("/api/admin/eventi", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    if (r.ok) {
      setEventi((prev) => prev.filter((e) => e.id !== id))
      if (eventoAperto === id) setEventoAperto(null)
      flash("Evento eliminato")
    }
  }

  async function salvaPercorso(pid: number) {
    const dati = editPercorso[pid] ?? {}
    const r = await fetch("/api/admin/percorsi", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pid, ...dati }),
    })
    if (r.ok) {
      const d = await r.json()
      setPercorsiMap((prev) => ({
        ...prev,
        [eventoAperto!]: prev[eventoAperto!].map((p) => p.id === pid ? { ...p, ...dati } : p),
      }))
      const msg = d.registrazioni_aggiornate > 0
        ? `Percorso salvato ✓ — ${d.registrazioni_aggiornate} registrazione${d.registrazioni_aggiornate > 1 ? 'i' : ''} ricalcolata${d.registrazioni_aggiornate > 1 ? '' : ''}`
        : "Percorso salvato ✓"
      flash(msg)
    } else flash("Errore salvataggio percorso")
  }

  async function eliminaPercorso(pid: number, eid: number) {
    if (!confirm("Eliminare questo percorso?")) return
    const r = await fetch("/api/admin/percorsi", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pid }),
    })
    if (r.ok) {
      setPercorsiMap((prev) => ({ ...prev, [eid]: prev[eid].filter((p) => p.id !== pid) }))
      flash("Percorso eliminato")
    }
  }

  async function aggiungiPercorso(eid: number) {
    const np = { ...nuovoPercorso, evento_id: eid }
    const r = await fetch("/api/admin/percorsi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(np),
    })
    if (r.ok) {
      const d = await r.json()
      setPercorsiMap((prev) => ({ ...prev, [eid]: [...(prev[eid] ?? []), d.percorso] }))
      setNuovoPercorso({})
      setAggiungiPercorsoId(null)
      flash("Percorso aggiunto ✓")
    } else flash("Errore aggiunta percorso")
  }

  function flash(testo: string) {
    setMsg(testo)
    setTimeout(() => setMsg(""), 3000)
  }

  const inputClass = "w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
  const labelClass = "block text-xs text-gray-500 mb-0.5"

  return (
    <div>
      <h2 className="font-semibold text-gray-700 mb-3">🗓 Gestione Eventi & Percorsi</h2>

      {msg && (
        <div className="mb-3 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: "#22c55e" }}>
          {msg}
        </div>
      )}

      {/* Ricerca */}
      <input
        type="search"
        placeholder="Cerca evento per nome..."
        value={query}
        onChange={(e) => { setQuery(e.target.value); setPage(0) }}
        className={inputClass + " mb-3"}
      />

      <div className="text-xs text-gray-400 mb-2">
        {loading ? "Caricamento..." : `${total} eventi trovati`}
      </div>

      {/* Lista eventi */}
      <div className="space-y-2">
        {eventi.map((ev) => (
          <div key={ev.id} className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header evento */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
              onClick={() => apriEvento(ev)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-800 text-sm truncate">{ev.nome}</span>
                  {ev.data_evento && (
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(ev.data_evento).toLocaleDateString("it-IT")}
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    ev.attivo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}>
                    {ev.attivo ? "attivo" : "inattivo"}
                  </span>
                  {ev.stato === "confermato" && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">conf.</span>
                  )}
                </div>
                {ev.tipologia && <div className="text-xs text-gray-400 mt-0.5">{ev.tipologia}</div>}
              </div>
              <span className="text-gray-400 ml-2 shrink-0">{eventoAperto === ev.id ? "▲" : "▼"}</span>
            </div>

            {/* Pannello editing evento */}
            {eventoAperto === ev.id && (
              <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">

                {/* Form evento */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="col-span-2">
                    <label className={labelClass}>Nome evento</label>
                    <input className={inputClass} value={editEvento.nome ?? ""} onChange={(e) => setEditEvento((p) => ({ ...p, nome: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Data inizio</label>
                    <input type="date" className={inputClass} value={editEvento.data_evento ?? ""} onChange={(e) => setEditEvento((p) => ({ ...p, data_evento: e.target.value || null }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Data fine</label>
                    <input type="date" className={inputClass} value={editEvento.data_fine ?? ""} onChange={(e) => setEditEvento((p) => ({ ...p, data_fine: e.target.value || null }))} />
                  </div>
                  <div>
                    <label className={labelClass}>Tipologia</label>
                    <select className={inputClass} value={editEvento.tipologia ?? ""} onChange={(e) => setEditEvento((p) => ({ ...p, tipologia: e.target.value || null }))}>
                      <option value="">— nessuna —</option>
                      {tipologie.map((t) => <option key={t.id} value={t.nome}>{t.nome}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Stato</label>
                    <select className={inputClass} value={editEvento.stato ?? "ricercato"} onChange={(e) => setEditEvento((p) => ({ ...p, stato: e.target.value }))}>
                      {STATI.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Luogo</label>
                    <input className={inputClass} value={editEvento.luogo ?? ""} onChange={(e) => setEditEvento((p) => ({ ...p, luogo: e.target.value || null }))} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>URL</label>
                    <input className={inputClass} value={editEvento.url ?? ""} onChange={(e) => setEditEvento((p) => ({ ...p, url: e.target.value || null }))} />
                  </div>
                  <div className="flex items-center gap-2 col-span-2">
                    <input type="checkbox" id={"attivo-" + ev.id} checked={editEvento.attivo ?? true}
                      onChange={(e) => setEditEvento((p) => ({ ...p, attivo: e.target.checked }))} />
                    <label htmlFor={"attivo-" + ev.id} className="text-sm text-gray-700">Evento attivo</label>
                  </div>
                </div>

                {/* Bottoni evento */}
                <div className="flex gap-2 mb-5">
                  <button onClick={() => salvaEvento(ev.id)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors">
                    Salva evento
                  </button>
                  <button onClick={() => eliminaEvento(ev.id)} className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-100 text-red-600 hover:bg-red-200 transition-colors">
                    Elimina evento
                  </button>
                </div>

                {/* Percorsi */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">📍 Percorsi ({(percorsiMap[ev.id] ?? []).length})</h3>
                    <button onClick={() => setAggiungiPercorsoId(ev.id === aggiungiPercorsoId ? null : ev.id)}
                      className="text-xs px-2 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-medium">
                      {aggiungiPercorsoId === ev.id ? "Annulla" : "+ Aggiungi"}
                    </button>
                  </div>

                  {/* Form nuovo percorso */}
                  {aggiungiPercorsoId === ev.id && (
                    <div className="border border-blue-200 rounded-lg p-3 mb-3 bg-blue-50">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div className="col-span-2">
                          <label className={labelClass}>Nome percorso</label>
                          <input className={inputClass} placeholder="Es. Percorso Lungo"
                            value={nuovoPercorso.nome_percorso ?? ""}
                            onChange={(e) => setNuovoPercorso((p) => ({ ...p, nome_percorso: e.target.value }))} />
                        </div>
                        <div>
                          <label className={labelClass}>Km</label>
                          <input type="number" className={inputClass}
                            value={nuovoPercorso.km ?? ""}
                            onChange={(e) => setNuovoPercorso((p) => ({ ...p, km: Number(e.target.value) || null }))} />
                        </div>
                        <div>
                          <label className={labelClass}>Dislivello (m)</label>
                          <input type="number" className={inputClass}
                            value={nuovoPercorso.dislivello_m ?? ""}
                            onChange={(e) => setNuovoPercorso((p) => ({ ...p, dislivello_m: Number(e.target.value) || null }))} />
                        </div>
                        <div className="col-span-2">
                          <label className={labelClass}>Tipologia</label>
                          <select className={inputClass}
                            value={nuovoPercorso.tipologia_id ?? ""}
                            onChange={(e) => setNuovoPercorso((p) => ({ ...p, tipologia_id: Number(e.target.value) || null }))}>
                            <option value="">— nessuna —</option>
                            {tipologie.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                          </select>
                        </div>
                      </div>
                      <button onClick={() => aggiungiPercorso(ev.id)}
                        className="w-full px-3 py-2 rounded-lg text-sm font-semibold bg-blue-500 text-white hover:bg-blue-600">
                        Aggiungi percorso
                      </button>
                    </div>
                  )}

                  {/* Lista percorsi esistenti */}
                  {(percorsiMap[ev.id] ?? []).length === 0 && (
                    <p className="text-xs text-gray-400 italic">Nessun percorso associato</p>
                  )}
                  {(percorsiMap[ev.id] ?? []).map((p) => {
                    const ep = editPercorso[p.id] ?? {}
                    return (
                      <div key={p.id} className="border border-gray-200 rounded-lg p-3 mb-2 bg-white">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="col-span-2">
                            <label className={labelClass}>Nome percorso</label>
                            <input className={inputClass}
                              value={ep.nome_percorso ?? p.nome_percorso ?? ""}
                              onChange={(e) => setEditPercorso((prev) => ({ ...prev, [p.id]: { ...prev[p.id], nome_percorso: e.target.value } }))} />
                          </div>
                          <div>
                            <label className={labelClass}>Km</label>
                            <input type="number" className={inputClass}
                              value={ep.km !== undefined ? (ep.km ?? "") : (p.km ?? "")}
                              onChange={(e) => setEditPercorso((prev) => ({ ...prev, [p.id]: { ...prev[p.id], km: Number(e.target.value) || null } }))} />
                          </div>
                          <div>
                            <label className={labelClass}>Dislivello (m)</label>
                            <input type="number" className={inputClass}
                              value={ep.dislivello_m !== undefined ? (ep.dislivello_m ?? "") : (p.dislivello_m ?? "")}
                              onChange={(e) => setEditPercorso((prev) => ({ ...prev, [p.id]: { ...prev[p.id], dislivello_m: Number(e.target.value) || null } }))} />
                          </div>
                          <div className="col-span-2">
                            <label className={labelClass}>Tipologia</label>
                            <select className={inputClass}
                              value={ep.tipologia_id !== undefined ? (ep.tipologia_id ?? "") : (p.tipologia_id ?? "")}
                              onChange={(e) => setEditPercorso((prev) => ({ ...prev, [p.id]: { ...prev[p.id], tipologia_id: Number(e.target.value) || null } }))}>
                              <option value="">— nessuna —</option>
                              {tipologie.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => salvaPercorso(p.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600">
                            Salva
                          </button>
                          <button onClick={() => eliminaPercorso(p.id, ev.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-600 hover:bg-red-200">
                            Elimina
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Paginazione */}
      {total > LIMIT && (
        <div className="flex items-center justify-between mt-4">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-600 disabled:opacity-40 hover:bg-gray-200">
            ← Precedente
          </button>
          <span className="text-xs text-gray-500">
            {page * LIMIT + 1}–{Math.min((page + 1) * LIMIT, total)} di {total}
          </span>
          <button disabled={(page + 1) * LIMIT >= total} onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-600 disabled:opacity-40 hover:bg-gray-200">
            Successivo →
          </button>
        </div>
      )}
    </div>
  )
}

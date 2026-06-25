'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import PageShell from '@/components/PageShell'

type Atleta = {
  id: string
  nome_cognome: string
  categoria_corrente: string
  categoria_prossima: string
  numero_tessera: string | null
  attivo: boolean
}

type FonteEventi = {
  id: number
  nome: string
  dominio: string
  url: string
  queries: string[]
  attiva: boolean
}

type Registrazione = {
  id: string
  evento: string
  data: string
  percorso: string
  km: number
  dislivello_m: number
  completato: boolean
  km_effettivi: number
  punti: number
}

export default function AdminClient() {
  const [atleti, setAtleti] = useState<Atleta[]>([])
  const [loading, setLoading] = useState(true)
  const [cerca, setCerca] = useState('')
  const [mostraInattivi, setMostraInattivi] = useState(false)
  const [atletaSelezionato, setAtletaSelezionato] = useState<Atleta | null>(null)
  const [regs, setRegs] = useState<Registrazione[]>([])
  const [loadingRegs, setLoadingRegs] = useState(false)
  const [editAtleta, setEditAtleta] = useState<Partial<Atleta>>({})
  const [editRegId, setEditRegId] = useState<string | null>(null)
  const [editPunti, setEditPunti] = useState('')
  const [msg, setMsg] = useState('')
  const [fonti, setFonti] = useState<FonteEventi[]>([])
  const [nuovaFonte, setNuovaFonte] = useState({ nome: '', dominio: '', url: '' })
  const [msgFonti, setMsgFonti] = useState('')
  const [lanciando, setLanciando] = useState(false)
  const [logRicerca, setLogRicerca] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/admin/fonti').then((r) => r.json()).then((d) => setFonti(d.fonti ?? []))
  }, [])

  useEffect(() => {
    fetch('/api/admin/atleti')
      .then((r) => r.json())
      .then((d) => setAtleti(d.atleti ?? []))
      .finally(() => setLoading(false))
  }, [])

  function selezionaAtleta(a: Atleta) {
    setAtletaSelezionato(a)
    setEditAtleta({ ...a })
    setRegs([])
    setEditRegId(null)
    setMsg('')
    setLoadingRegs(true)
    fetch(`/api/admin/registrazioni?atleta_id=${a.id}`)
      .then((r) => r.json())
      .then((d) => setRegs(d.registrazioni ?? []))
      .finally(() => setLoadingRegs(false))
  }

  async function salvaAtleta() {
    if (!atletaSelezionato) return
    const r = await fetch('/api/admin/atleti', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: atletaSelezionato.id, ...editAtleta }),
    })
    if (r.ok) {
      setAtleti((prev) => prev.map((a) => a.id === atletaSelezionato.id ? { ...a, ...editAtleta } as Atleta : a))
      setAtletaSelezionato({ ...atletaSelezionato, ...editAtleta } as Atleta)
      setMsg('Salvato.')
    } else {
      setMsg('Errore nel salvataggio.')
    }
  }

  async function toggleAttivo(a: Atleta) {
    const nuovoStato = !a.attivo
    await fetch('/api/admin/atleti', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: a.id, attivo: nuovoStato }),
    })
    setAtleti((prev) => prev.map((x) => x.id === a.id ? { ...x, attivo: nuovoStato } : x))
    if (atletaSelezionato?.id === a.id) {
      setAtletaSelezionato({ ...atletaSelezionato, attivo: nuovoStato })
      setEditAtleta((prev) => ({ ...prev, attivo: nuovoStato }))
    }
  }

  async function eliminaRegistrazione(id: string) {
    if (!confirm('Eliminare questa registrazione?')) return
    const r = await fetch('/api/admin/registrazioni', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (r.ok) {
      setRegs((prev) => prev.filter((x) => x.id !== id))
    } else {
      const d = await r.json().catch(() => ({}))
      alert('Errore cancellazione: ' + (d.error ?? r.status))
    }
  }

  async function salvaPunti(id: string) {
    const r = await fetch('/api/admin/registrazioni', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, punti: editPunti }),
    })
    if (r.ok) {
      setRegs((prev) => prev.map((x) => x.id === id ? { ...x, punti: Number(editPunti) } : x))
      setEditRegId(null)
    }
  }

  async function aggiungiFonte() {
    if (!nuovaFonte.nome.trim() || !nuovaFonte.url.trim()) return
    const dominioCalcolato = nuovaFonte.dominio.trim() ||
      (() => { try { return new URL(nuovaFonte.url).hostname.replace('www.', '') } catch { return '' } })()
    const r = await fetch('/api/admin/fonti', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...nuovaFonte, dominio: dominioCalcolato }),
    })
    if (r.ok) {
      const d = await r.json()
      setFonti((prev) => [...prev, d.fonte])
      setNuovaFonte({ nome: '', dominio: '', url: '' })
      setMsgFonti('Fonte aggiunta.')
    } else {
      setMsgFonti('Errore nel salvataggio.')
    }
  }

  async function toggleFonte(f: FonteEventi) {
    await fetch('/api/admin/fonti', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: f.id, attiva: !f.attiva }),
    })
    setFonti((prev) => prev.map((x) => x.id === f.id ? { ...x, attiva: !f.attiva } : x))
  }

  async function lanciaRicerca() {
    const fontiAttive = fonti.filter((f) => f.attiva)
    if (fontiAttive.length === 0) { setMsgFonti('Nessuna fonte attiva.'); return }
    setLanciando(true)
    setLogRicerca([`Avvio ricerca su ${fontiAttive.length} fonti...`])
    for (let i = 0; i < fontiAttive.length; i++) {
      const f = fontiAttive[i]
      setLogRicerca((prev) => [...prev, `⏳ ${f.nome}...`])
      try {
        // Trova l'indice globale nella lista completa (il backend usa l'indice della lista attiva ordinata)
        const idxGlobale = fonti.filter((x) => x.attiva).indexOf(f)
        const res = await fetch(`/api/cron/scopri-eventi?fonte=${idxGlobale}`)
        const data = await res.json()
        const riga = data.log?.[0] ?? `${f.nome}: completato`
        setLogRicerca((prev) => [...prev.slice(0, -1), riga])
      } catch {
        setLogRicerca((prev) => [...prev.slice(0, -1), `❌ ${f.nome}: errore di rete`])
      }
    }
    setLogRicerca((prev) => [...prev, '✅ Ricerca completata.'])
    setLanciando(false)
  }

  async function eliminaFonte(id: number) {
    if (!confirm('Eliminare questa fonte?')) return
    const r = await fetch('/api/admin/fonti', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (r.ok) setFonti((prev) => prev.filter((x) => x.id !== id))
  }

  const atletiFiltrati = atleti.filter((a) => {
    const matchCerca = a.nome_cognome.toLowerCase().includes(cerca.toLowerCase())
    const matchAttivo = mostraInattivi ? true : a.attivo
    return matchCerca && matchAttivo
  })

  return (
    <PageShell title="Pannello Admin">
      <div className="max-w-2xl mx-auto">

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Lista atleti */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Atleti</h2>
            <input
              type="text"
              placeholder="Cerca atleta..."
              value={cerca}
              onChange={(e) => setCerca(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 mb-2 outline-none focus:border-orange-400"
            />
            <label className="flex items-center gap-2 text-xs text-gray-500 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={mostraInattivi}
                onChange={(e) => setMostraInattivi(e.target.checked)}
                className="accent-orange-500"
              />
              Mostra anche inattivi
            </label>
            {loading ? (
              <div className="text-sm text-gray-400 text-center py-4">Caricamento...</div>
            ) : (
              <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
                {atletiFiltrati.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => selezionaAtleta(a)}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between gap-2 ${
                      atletaSelezionato?.id === a.id
                        ? 'bg-orange-50 border border-orange-300 text-orange-700'
                        : 'hover:bg-gray-50 text-gray-800'
                    }`}
                  >
                    <span className={a.attivo ? '' : 'line-through text-gray-400'}>{a.nome_cognome}</span>
                    <span className="text-xs text-gray-400 shrink-0">
                      {a.categoria_corrente === 'AMATORI' ? 'AM' : 'CT'}
                    </span>
                  </button>
                ))}
                {atletiFiltrati.length === 0 && (
                  <div className="text-sm text-gray-400 text-center py-4">Nessun atleta trovato</div>
                )}
              </div>
            )}
          </div>

          {/* Dettaglio atleta */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            {!atletaSelezionato ? (
              <div className="text-sm text-gray-400 text-center py-10">Seleziona un atleta</div>
            ) : (
              <div>
                <h2 className="font-semibold text-gray-700 mb-3 truncate">{atletaSelezionato.nome_cognome}</h2>

                {/* Stato attivo */}
                <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-xl">
                  <span className="text-sm text-gray-700">
                    {atletaSelezionato.attivo ? 'Atleta attivo' : 'Atleta inattivo'}
                  </span>
                  <button
                    onClick={() => toggleAttivo(atletaSelezionato)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                      atletaSelezionato.attivo
                        ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
                    }`}
                  >
                    {atletaSelezionato.attivo ? 'Disattiva' : 'Riattiva'}
                  </button>
                </div>

                {/* Categoria */}
                <div className="mb-3">
                  <label className="text-xs text-gray-500 block mb-1">Categoria corrente</label>
                  <select
                    value={editAtleta.categoria_corrente ?? ''}
                    onChange={(e) => setEditAtleta((p) => ({ ...p, categoria_corrente: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400"
                  >
                    <option value="AMATORI">Amatori</option>
                    <option value="CICLOTURISTI">Cicloturisti</option>
                  </select>
                </div>

                <div className="mb-3">
                  <label className="text-xs text-gray-500 block mb-1">Categoria prossima stagione</label>
                  <select
                    value={editAtleta.categoria_prossima ?? ''}
                    onChange={(e) => setEditAtleta((p) => ({ ...p, categoria_prossima: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400"
                  >
                    <option value="AMATORI">Amatori</option>
                    <option value="CICLOTURISTI">Cicloturisti</option>
                  </select>
                </div>

                {/* Numero tessera */}
                <div className="mb-4">
                  <label className="text-xs text-gray-500 block mb-1">Numero tessera</label>
                  <input
                    type="text"
                    value={editAtleta.numero_tessera ?? ''}
                    onChange={(e) => setEditAtleta((p) => ({ ...p, numero_tessera: e.target.value }))}
                    placeholder="es. 12345"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 outline-none focus:border-orange-400"
                  />
                </div>

                <button
                  onClick={salvaAtleta}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold py-2 rounded-lg transition-colors mb-2"
                >
                  Salva modifiche
                </button>
                {msg && <div className="text-xs text-center text-gray-500">{msg}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Fonti eventi */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-700">Siti fonte eventi</h2>
            <button
              onClick={lanciaRicerca}
              disabled={lanciando}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-orange-500 text-white disabled:opacity-50 hover:bg-orange-600 transition-colors"
            >
              {lanciando ? 'In corso...' : '▶ Lancia ricerca'}
            </button>
          </div>

          {logRicerca.length > 0 && (
            <div className="mb-4 bg-gray-50 border border-gray-100 rounded-xl p-3 flex flex-col gap-1">
              {logRicerca.map((riga, i) => (
                <div key={i} className="text-xs text-gray-700 font-mono">{riga}</div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 mb-4">
            {fonti.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 border border-gray-100 rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-gray-800">{f.nome}</div>
                  <a href={f.url} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-500 hover:underline truncate block">{f.url}</a>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleFonte(f)}
                    className={`text-xs px-2 py-0.5 rounded-full border ${f.attiva ? 'text-green-600 border-green-200 bg-green-50' : 'text-gray-400 border-gray-200 bg-gray-50'}`}
                  >
                    {f.attiva ? 'attiva' : 'disattiva'}
                  </button>
                  <button onClick={() => eliminaFonte(f.id)} className="text-xs text-red-400 hover:text-red-600">🗑</button>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-500 mb-2">Aggiungi sito</div>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="Nome (es. Fiab)"
                value={nuovaFonte.nome}
                onChange={(e) => setNuovaFonte((p) => ({ ...p, nome: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="url"
                placeholder="URL (es. https://www.fiab.it/calendario)"
                value={nuovaFonte.url}
                onChange={(e) => setNuovaFonte((p) => ({ ...p, url: e.target.value }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <button
                onClick={aggiungiFonte}
                disabled={!nuovaFonte.nome.trim() || !nuovaFonte.url.trim()}
                className="bg-orange-500 text-white text-sm font-semibold rounded-lg py-2 disabled:opacity-40"
              >
                Aggiungi
              </button>
              {msgFonti && <div className="text-xs text-center text-gray-500">{msgFonti}</div>}
            </div>
          </div>
        </div>

        {/* Registrazioni atleta selezionato */}
        {atletaSelezionato && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mt-6">
            <h2 className="font-semibold text-gray-700 mb-3">
              Registrazioni di {atletaSelezionato.nome_cognome}
            </h2>
            {loadingRegs ? (
              <div className="text-sm text-gray-400 text-center py-4">Caricamento...</div>
            ) : regs.length === 0 ? (
              <div className="text-sm text-gray-400 text-center py-4">Nessuna registrazione</div>
            ) : (
              <div className="flex flex-col gap-2">
                {regs.map((r) => (
                  <div key={r.id} className="border border-gray-100 rounded-xl px-3 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-gray-400">
                          {r.data ? new Date(r.data + 'T12:00:00').toLocaleDateString('it-IT') : '—'}
                        </div>
                        <div className="font-medium text-gray-900 text-sm truncate">{r.evento}</div>
                        <div className="text-xs text-gray-500">{r.percorso} · {r.km} km</div>
                        {!r.completato && (
                          <div className="text-xs text-yellow-600">parziale · {r.km_effettivi} km</div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {editRegId === r.id ? (
                          <>
                            <input
                              type="number"
                              value={editPunti}
                              onChange={(e) => setEditPunti(e.target.value)}
                              className="w-16 border border-orange-300 rounded px-2 py-1 text-sm text-center"
                            />
                            <button
                              onClick={() => salvaPunti(r.id)}
                              className="text-xs text-green-600 font-semibold hover:underline"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setEditRegId(null)}
                              className="text-xs text-gray-400 hover:underline"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditRegId(r.id); setEditPunti(String(r.punti)) }}
                              className="font-bold text-orange-500 text-sm hover:underline"
                            >
                              {r.punti} pt
                            </button>
                            <button
                              onClick={() => eliminaRegistrazione(r.id)}
                              className="text-xs text-red-400 hover:text-red-600"
                              title="Elimina"
                            >
                              🗑
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  )
}

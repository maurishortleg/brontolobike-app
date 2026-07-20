'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// ── Tipi ─────────────────────────────────────────────────────────────────────

export type PercorsoEvento = {
  nome: string
  km: number | null
  dislivello: number | null
  tipologia: string | null
}

export type EventoUnificato = {
  id: string                 // "ricercato-<id>" o "db-<id>"
  sorgente: 'ricercato' | 'db'
  nome: string
  data: string | null        // YYYY-MM-DD
  data_fine: string | null
  luogo: string | null
  tipologia: string | null
  url: string | null
  percorsi: PercorsoEvento[]
  immagine_url?: string | null
}

// ── Colori tipologia ──────────────────────────────────────────────────────────

function colorePerTipologia(tipologia: string | null): string {
  if (!tipologia) return '#6b7280'
  const t = tipologia.toLowerCase()
  if (t.includes('gran') || t.includes('medio fondo')) return '#FF5500'
  if (t.includes('gravelland') || t.includes('gravelland')) return '#16a34a'
  if (t.includes('gravel')) return '#22c55e'
  if (t.includes('mtb')) return '#15803d'
  if (t.includes('randonn')) return '#0055CC'
  if (t.includes('ciclocross')) return '#7c3aed'
  if (t.includes('pedalata')) return '#D8FF00'
  if (t.includes('brevetto')) return '#06b6d4'
  if (t.includes('trail')) return '#d97706'
  if (t.includes('brontolo')) return '#FF006E'
  if (t.includes('uva') || t.includes('fragola')) return '#a855f7'
  if (t.includes('circuito') || t.includes('crit')) return '#ef4444'
  return '#6b7280'
}

function formatData(data: string | null, dataFine: string | null): string {
  if (!data) return 'Data da definire'
  const fmt = (d: string) =>
    new Date(d + 'T12:00:00').toLocaleDateString('it-IT', {
      day: 'numeric', month: 'short',
    })
  if (dataFine && dataFine !== data) return `${fmt(data)} – ${fmt(dataFine)}`
  return fmt(data)
}

function isProssimo(data: string | null): boolean {
  if (!data) return true
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)
  return new Date(data + 'T00:00:00') >= oggi
}

// ── Componente card percorso ──────────────────────────────────────────────────

function PercorsoCard({
  percorso,
  evento,
  onRegistra,
}: {
  percorso: PercorsoEvento
  evento: EventoUnificato
  onRegistra: (ev: EventoUnificato, p: PercorsoEvento) => void
}) {
  const colore = colorePerTipologia(percorso.tipologia ?? evento.tipologia)

  return (
    <div
      className="flex items-center justify-between gap-2 py-2 px-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: colore }}
        />
        <div className="min-w-0">
          <span className="text-xs font-semibold text-white truncate block">
            {percorso.nome || 'Percorso unico'}
          </span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {percorso.km != null ? `${percorso.km} km` : ''}
            {percorso.km != null && percorso.dislivello != null ? ' · ' : ''}
            {percorso.dislivello != null ? `↑${percorso.dislivello} m` : ''}
            {!percorso.km && !percorso.dislivello ? 'Dati non disponibili' : ''}
          </span>
        </div>
      </div>
      <button
        onClick={() => onRegistra(evento, percorso)}
        className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
        style={{
          background: 'linear-gradient(105deg, #FF006E 0%, #FF5500 100%)',
          color: '#fff',
          boxShadow: '0 0 10px rgba(255,85,0,0.3)',
        }}
      >
        🚴 Registra
      </button>
    </div>
  )
}

// ── Componente card evento ────────────────────────────────────────────────────

function EventoCard({
  evento,
  onRegistra,
}: {
  evento: EventoUnificato
  onRegistra: (ev: EventoUnificato, p?: PercorsoEvento) => void
}) {
  const [espanso, setEspanso] = useState(false)
  const colore = colorePerTipologia(evento.tipologia)
  const passato = evento.data && new Date(evento.data + 'T00:00:00') < (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: `1px solid ${espanso ? colore + '55' : 'rgba(255,255,255,0.09)'}`,
        opacity: passato ? 0.6 : 1,
      }}
    >
      {/* Header evento */}
      <button
        className="w-full text-left px-4 py-3 flex items-start gap-3"
        onClick={() => setEspanso((v) => !v)}
      >
        {/* Pallino tipologia */}
        <div
          className="w-3 h-3 rounded-full mt-1 shrink-0"
          style={{ background: colore }}
        />

        <div className="flex-1 min-w-0">
          {/* Data */}
          <div className="text-xs font-bold mb-0.5" style={{ color: colore }}>
            {formatData(evento.data, evento.data_fine)}
            {passato && <span className="ml-2 text-gray-500 font-normal">(passato)</span>}
          </div>
          {/* Nome */}
          <div className="text-sm font-bold text-white leading-tight truncate">
            {evento.nome}
          </div>
          {/* Luogo + tipologia */}
          {(evento.luogo || evento.tipologia) && (
            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.45)' }}>
              {evento.luogo && <span>{evento.luogo}</span>}
              {evento.luogo && evento.tipologia && <span className="mx-1">·</span>}
              {evento.tipologia && <span>{evento.tipologia}</span>}
            </div>
          )}
        </div>

        {/* Freccia + n. percorsi */}
        <div className="flex items-center gap-2 shrink-0">
          {evento.percorsi.length > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}
            >
              {evento.percorsi.length} perc.
            </span>
          )}
          <span
            className="text-xs transition-transform duration-200"
            style={{
              color: 'rgba(255,255,255,0.4)',
              transform: espanso ? 'rotate(180deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}
          >
            ▾
          </span>
        </div>
      </button>

      {/* Percorsi espansi */}
      {espanso && (
        <div className="px-4 pb-3 flex flex-col gap-2">
          {evento.percorsi.length > 0 ? (
            evento.percorsi.map((p, i) => (
              <PercorsoCard
                key={i}
                percorso={p}
                evento={evento}
                onRegistra={onRegistra}
              />
            ))
          ) : (
            /* Nessun percorso: bottone Registra generico */
            <button
              onClick={() => onRegistra(evento)}
              className="w-full text-sm font-bold py-2 rounded-xl transition-all"
              style={{
                background: 'linear-gradient(105deg, #FF006E 0%, #FF5500 100%)',
                color: '#fff',
              }}
            >
              🚴 Registra questo evento
            </button>
          )}
          {evento.url && (
            <a
              href={evento.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-center transition-colors mt-1"
              style={{ color: 'rgba(255,255,255,0.3)' }}
            >
              Vai al sito dell&apos;evento ↗
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ── Componente principale ─────────────────────────────────────────────────────

export default function HomeEventiList({ eventi }: { eventi: EventoUnificato[] }) {
  const router = useRouter()
  const [filtro, setFiltro] = useState<'tutti' | 'prossimi'>('prossimi')

  const eventiFiltrati = filtro === 'prossimi'
    ? eventi.filter((e) => isProssimo(e.data))
    : eventi

  function handleRegistra(ev: EventoUnificato, percorso?: PercorsoEvento) {
    const params = new URLSearchParams()
    params.set('nome', ev.nome)
    if (ev.data) params.set('data', ev.data)
    if (ev.luogo) params.set('luogo', ev.luogo)
    if (ev.url) params.set('url', ev.url)
    if (percorso) {
      params.set('percorso_nome', percorso.nome || '')
      if (percorso.km != null) params.set('percorso_km', String(percorso.km))
      if (percorso.dislivello != null) params.set('percorso_dislivello', String(percorso.dislivello))
      if (percorso.tipologia) params.set('percorso_tipologia', percorso.tipologia)
    } else if (ev.tipologia) {
      params.set('tipologia', ev.tipologia)
    }
    router.push(`/registra?${params.toString()}`)
  }

  if (eventi.length === 0) {
    return (
      <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.3)' }}>
        <div className="text-2xl mb-2">🚴</div>
        <p className="text-sm">Nessun evento disponibile al momento</p>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header sezione */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold tracking-wide uppercase" style={{ color: 'rgba(255,255,255,0.5)' }}>
          📅 Eventi
        </h2>
        {/* Toggle prossimi / tutti */}
        <div
          className="flex rounded-lg overflow-hidden text-xs font-semibold"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}
        >
          {(['prossimi', 'tutti'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setFiltro(v)}
              className="px-3 py-1.5 transition-all"
              style={{
                background: filtro === v ? 'rgba(255,255,255,0.12)' : 'transparent',
                color: filtro === v ? '#fff' : 'rgba(255,255,255,0.4)',
              }}
            >
              {v === 'prossimi' ? 'Prossimi' : 'Tutti'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista scrollabile */}
      <div
        className="flex flex-col gap-2 overflow-y-auto pr-1"
        style={{ maxHeight: '60vh' }}
      >
        {eventiFiltrati.length === 0 ? (
          <div className="text-center py-6 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
            Nessun evento prossimo — passa a &quot;Tutti&quot; per vedere la lista completa
          </div>
        ) : (
          eventiFiltrati.map((ev) => (
            <EventoCard key={ev.id} evento={ev} onRegistra={handleRegistra} />
          ))
        )}
      </div>

      <p className="text-center text-xs mt-3" style={{ color: 'rgba(255,255,255,0.2)' }}>
        {eventiFiltrati.length} {eventiFiltrati.length === 1 ? 'evento' : 'eventi'}
        {filtro === 'prossimi' ? ' prossimi' : ' in totale'}
      </p>
    </div>
  )
}

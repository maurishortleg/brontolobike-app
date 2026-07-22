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
  id: string
  sorgente: 'ricercato' | 'db'
  nome: string
  data: string | null
  data_fine: string | null
  luogo: string | null
  tipologia: string | null
  url: string | null
  percorsi: PercorsoEvento[]
  immagine_url?: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function colorePerTipologia(tipologia: string | null): string {
  if (!tipologia) return '#6b7280'
  const t = tipologia.toLowerCase()
  if (t.includes('gran') || t.includes('medio fondo')) return '#FF5500'
  if (t.includes('gravelland')) return '#16a34a'
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

// ── PercorsoCard ─────────────────────────────────────────────────────────────

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
  const dettagli = [
    percorso.km != null ? `${percorso.km} km` : null,
    percorso.dislivello != null ? `↑${percorso.dislivello} m` : null,
  ].filter(Boolean).join(' · ') || 'Dati non disponibili'

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '8px 12px',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: colore, flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {percorso.nome || 'Percorso unico'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
            {dettagli}
          </div>
        </div>
      </div>
      <button
        onClick={() => onRegistra(evento, percorso)}
        style={{
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 700,
          padding: '6px 12px',
          borderRadius: 8,
          background: 'linear-gradient(105deg, #FF006E 0%, #FF5500 100%)',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 0 10px rgba(255,85,0,0.3)',
        }}
      >
        🚴 Registra
      </button>
    </div>
  )
}

// ── EventoCard ───────────────────────────────────────────────────────────────

function EventoCard({
  evento,
  onRegistra,
}: {
  evento: EventoUnificato
  onRegistra: (ev: EventoUnificato, p?: PercorsoEvento) => void
}) {
  const [espanso, setEspanso] = useState(false)
  const colore = colorePerTipologia(evento.tipologia)
  const oggi = new Date(); oggi.setHours(0, 0, 0, 0)
  const passato = evento.data ? new Date(evento.data + 'T00:00:00') < oggi : false

  return (
    <div style={{
      borderRadius: 16,
      overflow: 'hidden',
      background: 'rgba(255,255,255,0.06)',
      border: `1px solid ${espanso ? colore + '66' : 'rgba(255,255,255,0.1)'}`,
      opacity: passato ? 0.6 : 1,
      transition: 'border-color 0.2s',
    }}>
      {/* Riga evento — clicca per espandere */}
      <button
        onClick={() => setEspanso(v => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        {/* Pallino tipologia */}
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: colore, flexShrink: 0, marginTop: 4 }} />

        {/* Testi */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: colore, marginBottom: 2 }}>
            {formatData(evento.data, evento.data_fine)}
            {passato && <span style={{ color: '#6b7280', fontWeight: 400, marginLeft: 6 }}>(passato)</span>}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
            {evento.nome}
          </div>
          {(evento.luogo || evento.tipologia) && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
              {[evento.luogo, evento.tipologia].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>

        {/* Badge n. percorsi + freccia */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {evento.percorsi.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              padding: '2px 7px', borderRadius: 99,
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.5)',
            }}>
              {evento.percorsi.length}
            </span>
          )}
          <span style={{
            color: 'rgba(255,255,255,0.35)',
            fontSize: 12,
            display: 'inline-block',
            transform: espanso ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>▾</span>
        </div>
      </button>

      {/* Percorsi espansi */}
      {espanso && (
        <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {evento.percorsi.length > 0 ? (
            evento.percorsi.map((p, i) => (
              <PercorsoCard key={i} percorso={p} evento={evento} onRegistra={onRegistra} />
            ))
          ) : (
            <button
              onClick={() => onRegistra(evento)}
              style={{
                width: '100%', padding: '10px', borderRadius: 12,
                background: 'linear-gradient(105deg, #FF006E 0%, #FF5500 100%)',
                color: '#ffffff', fontWeight: 700, fontSize: 13,
                border: 'none', cursor: 'pointer',
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
              style={{ fontSize: 11, textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 4, display: 'block' }}
            >
              Vai al sito ↗
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
    ? eventi.filter(e => isProssimo(e.data))
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
      <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(255,255,255,0.3)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🚴</div>
        <p style={{ fontSize: 13 }}>Nessun evento disponibile al momento</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
          📅 Eventi
        </span>
        {/* Toggle */}
        <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
          {(['prossimi', 'tutti'] as const).map(v => (
            <button
              key={v}
              onClick={() => setFiltro(v)}
              style={{
                padding: '5px 12px',
                fontSize: 11,
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                background: filtro === v ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: filtro === v ? '#ffffff' : 'rgba(255,255,255,0.4)',
                transition: 'all 0.15s',
              }}
            >
              {v === 'prossimi' ? 'Prossimi' : 'Tutti'}
            </button>
          ))}
        </div>
      </div>

      {/* Lista — block container per evitare flex-shrink sui figli */}
      <div style={{ overflowY: 'auto', maxHeight: '60vh', paddingRight: 2 }}>
        {eventiFiltrati.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            Nessun evento prossimo — passa a &quot;Tutti&quot; per la lista completa
          </div>
        ) : (
          eventiFiltrati.map(ev => (
            <div key={ev.id} style={{ marginBottom: 8 }}>
              <EventoCard evento={ev} onRegistra={handleRegistra} />
            </div>
          ))
        )}
      </div>

      <p style={{ textAlign: 'center', fontSize: 11, marginTop: 10, color: 'rgba(255,255,255,0.2)' }}>
        {eventiFiltrati.length} {eventiFiltrati.length === 1 ? 'evento' : 'eventi'}{filtro === 'prossimi' ? ' prossimi' : ' in totale'}
      </p>
    </div>
  )
}

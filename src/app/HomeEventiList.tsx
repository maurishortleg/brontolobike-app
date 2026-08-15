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
  isLibero?: boolean // true per Brevetti Permanenti e Percorsi con Credenziale
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
  if (t.includes('credenziale')) return '#0891b2'
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
          padding: '5px 10px',
          borderRadius: 8,
          background: 'rgba(255,85,0,0.15)',
          border: '1px solid rgba(255,85,0,0.4)',
          color: '#FF5500',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        + Registra
      </button>
    </div>
  )
}

// ── EventoCard (con data) ─────────────────────────────────────────────────────

function EventoCard({
  evento,
  onRegistra,
}: {
  evento: EventoUnificato
  onRegistra: (ev: EventoUnificato, p?: PercorsoEvento) => void
}) {
  const [aperto, setAperto] = useState(false)
  const colore = colorePerTipologia(evento.tipologia)
  const haPercorsi = evento.percorsi.length > 0

  return (
    <div style={{
      borderRadius: 14,
      background: 'rgba(255,255,255,0.05)',
      border: `1px solid rgba(255,255,255,0.1)`,
      overflow: 'hidden',
    }}>
      {/* Header card */}
      <button
        onClick={() => setAperto(!aperto)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          textAlign: 'left',
        }}
      >
        {/* Indicatore colore */}
        <div style={{ width: 3, borderRadius: 4, background: colore, alignSelf: 'stretch', flexShrink: 0, minHeight: 36 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Data */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: colore, textTransform: 'uppercase', marginBottom: 2 }}>
            {formatData(evento.data, evento.data_fine)}
            {evento.luogo && <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400, marginLeft: 6 }}>· {evento.luogo}</span>}
          </div>
          {/* Nome */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {evento.nome}
          </div>
          {/* Tipologia */}
          {evento.tipologia && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              {evento.tipologia}
              {haPercorsi && <span style={{ marginLeft: 6, color: 'rgba(255,255,255,0.25)' }}>· {evento.percorsi.length} percorso{evento.percorsi.length > 1 ? 'i' : ''}</span>}
            </div>
          )}
        </div>

        {/* Chevron */}
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, paddingTop: 2, flexShrink: 0, transition: 'transform 0.2s', transform: aperto ? 'rotate(180deg)' : 'none' }}>
          ▾
        </div>
      </button>

      {/* Dettagli espansi */}
      {aperto && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {evento.immagine_url && (
            <img
              src={evento.immagine_url}
              alt={evento.nome}
              style={{ width: '100%', borderRadius: 10, maxHeight: 140, objectFit: 'cover', marginBottom: 4 }}
            />
          )}
          {haPercorsi ? (
            evento.percorsi.map((p, i) => (
              <PercorsoCard key={i} percorso={p} evento={evento} onRegistra={onRegistra} />
            ))
          ) : (
            <button
              onClick={() => onRegistra(evento)}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(255,85,0,0.12)',
                border: '1.5px solid rgba(255,85,0,0.3)',
                color: '#FF5500',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
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

// ── EventoLiberoCard (senza data fissa) ──────────────────────────────────────

function EventoLiberoCard({
  evento,
  onRegistra,
}: {
  evento: EventoUnificato
  onRegistra: (ev: EventoUnificato, p?: PercorsoEvento) => void
}) {
  const [aperto, setAperto] = useState(false)
  const colore = '#06b6d4' // cyan per i percorsi liberi
  const haPercorsi = evento.percorsi.length > 0

  return (
    <div style={{
      borderRadius: 14,
      background: 'rgba(6,182,212,0.05)',
      border: '1px solid rgba(6,182,212,0.2)',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setAperto(!aperto)}
        style={{
          width: '100%',
          padding: '12px 14px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          textAlign: 'left',
        }}
      >
        <div style={{ width: 3, borderRadius: 4, background: colore, alignSelf: 'stretch', flexShrink: 0, minHeight: 36 }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Badge tipologia */}
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: colore, textTransform: 'uppercase', marginBottom: 2 }}>
            {evento.tipologia ?? 'Percorso libero'}
          </div>
          {/* Nome */}
          <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {evento.nome}
          </div>
          {/* Luogo se disponibile */}
          {evento.luogo && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
              📍 {evento.luogo}
            </div>
          )}
          {haPercorsi && (
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>
              {evento.percorsi.length} percorso{evento.percorsi.length > 1 ? 'i' : ''} disponibile{evento.percorsi.length > 1 ? 'i' : ''}
            </div>
          )}
        </div>

        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, paddingTop: 2, flexShrink: 0, transition: 'transform 0.2s', transform: aperto ? 'rotate(180deg)' : 'none' }}>
          ▾
        </div>
      </button>

      {aperto && (
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Info "quando vuoi" */}
          <div style={{
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(6,182,212,0.08)',
            border: '1px solid rgba(6,182,212,0.15)',
            fontSize: 11,
            color: 'rgba(6,182,212,0.8)',
          }}>
            📅 Nessuna data fissa — puoi farlo in qualsiasi momento della stagione.
            <br />
            Al momento della registrazione inserisci la data in cui l&apos;hai completato.
          </div>

          {evento.immagine_url && (
            <img
              src={evento.immagine_url}
              alt={evento.nome}
              style={{ width: '100%', borderRadius: 10, maxHeight: 140, objectFit: 'cover', marginBottom: 4 }}
            />
          )}

          {haPercorsi ? (
            evento.percorsi.map((p, i) => (
              <PercorsoCard key={i} percorso={p} evento={evento} onRegistra={onRegistra} />
            ))
          ) : (
            <button
              onClick={() => onRegistra(evento)}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(6,182,212,0.1)',
                border: '1.5px solid rgba(6,182,212,0.3)',
                color: '#06b6d4',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              🚴 Registra questo percorso
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
  const [liberiAperti, setLiberiAperti] = useState(false)

  // Separa eventi con data fissa da quelli liberi
  const eventiDatati = eventi.filter(e => !e.isLibero)
  const eventiLiberi = eventi.filter(e => e.isLibero)

  const eventiFiltrati = filtro === 'prossimi'
    ? eventiDatati.filter(e => isProssimo(e.data))
    : eventiDatati

  function handleRegistra(ev: EventoUnificato, percorso?: PercorsoEvento) {
    const params = new URLSearchParams()
    params.set('nome', ev.nome)
    // Per eventi liberi, non passiamo la data: il form userà "oggi" come default
    if (!ev.isLibero && ev.data) params.set('data', ev.data)
    if (ev.luogo) params.set('luogo', ev.luogo)
    if (ev.url) params.set('url', ev.url)
    if (ev.tipologia) params.set('tipologia', ev.tipologia)
    if (percorso) {
      params.set('percorso_nome', percorso.nome || '')
      if (percorso.km != null) params.set('percorso_km', String(percorso.km))
      if (percorso.dislivello != null) params.set('percorso_dislivello', String(percorso.dislivello))
      if (percorso.tipologia) params.set('percorso_tipologia', percorso.tipologia)
    }
    router.push(`/registra?${params.toString()}`)
  }

  if (eventiDatati.length === 0 && eventiLiberi.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'rgba(255,255,255,0.35)' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🚴</div>
        <p style={{ fontSize: 13 }}>Nessun evento disponibile al momento</p>
      </div>
    )
  }

  return (
    <div style={{ width: '100%' }}>

      {/* ── Brevetti Permanenti e Cicloitinerari (SOPRA gli eventi) ─────────── */}
      {eventiLiberi.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {/* Header sezione liberi */}
          <button
            onClick={() => setLiberiAperti(!liberiAperti)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '4px 0',
              marginBottom: liberiAperti ? 10 : 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#06b6d4' }}>
                🔓 Brevetti Permanenti e Cicloitinerari con Credenziale
              </span>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 7px',
                borderRadius: 20,
                background: 'rgba(6,182,212,0.15)',
                color: '#06b6d4',
                border: '1px solid rgba(6,182,212,0.25)',
              }}>
                {eventiLiberi.length}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                {liberiAperti ? 'Chiudi' : 'Mostra'}
              </span>
              <span style={{ color: '#06b6d4', fontSize: 12, transition: 'transform 0.2s', transform: liberiAperti ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>
                ▾
              </span>
            </div>
          </button>

          {/* Descrizione (quando chiuso) */}
          {!liberiAperti && (
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginBottom: 4, marginTop: 4 }}>
              Disponibili tutto l&apos;anno, senza data fissa
            </p>
          )}

          {/* Lista liberi (collassabile) */}
          {liberiAperti && (
            <div>
              {eventiLiberi.map(ev => (
                <div key={ev.id} style={{ marginBottom: 8 }}>
                  <EventoLiberoCard evento={ev} onRegistra={handleRegistra} />
                </div>
              ))}
            </div>
          )}

          {/* Separatore */}
          <div style={{ height: 1, background: 'rgba(6,182,212,0.15)', marginTop: 12 }} />
        </div>
      )}

      {/* ── Sezione eventi con data fissa ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
          📅 Eventi
        </span>
        {/* Toggle Prossimi / Tutti */}
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

      {/* Lista eventi datati */}
      <div style={{ overflowY: 'auto', maxHeight: '55vh', paddingRight: 2 }}>
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

      <p style={{ textAlign: 'center', fontSize: 11, marginTop: 8, color: 'rgba(255,255,255,0.2)' }}>
        {eventiFiltrati.length} {eventiFiltrati.length === 1 ? 'evento' : 'eventi'}{filtro === 'prossimi' ? ' prossimi' : ' in totale'}
      </p>

    </div>
  )
}

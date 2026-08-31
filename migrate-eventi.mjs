// Script migrazione: eventi_ricercati → eventi + percorsi
// Da eseguire DOPO che il SQL schema è stato applicato su Supabase
// Uso: node --env-file=.env.local migrate-eventi.mjs

import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const TIPOLOGIA_ID_MAP = {
  'Gran/Medio Fondo': 1, 'Randonnée fino a 120Km': 2, 'Randonnée oltre i 120Km': 3,
  'Pedalata Cicloturistica': 4, 'Brevetto Permanente Strada': 5, 'Brevetto Permanente Gravel': 6,
  'Percorso con Credenziale': 7, 'Ciclocross': 8, 'MTB': 9, 'Gravel': 10,
  'Gara in Circuito (CRIT)': 11, 'Gravel di GRAvellAND': 12, 'Trail': 13,
  'Brontolo Bike Day': 14, 'Uva Fragola': 15, 'Bike Camp Livigno': 16,
}

async function main() {
  console.log('=== Migrazione eventi_ricercati → eventi ===\n')

  const { data: ricercati, error: errR } = await sb.from('eventi_ricercati').select('*').order('id')
  if (errR) { console.error('Errore:', errR); process.exit(1) }
  console.log(`Trovati ${ricercati.length} eventi in eventi_ricercati\n`)

  const { data: esistenti } = await sb.from('eventi').select('id, nome')
  const nomiEsistenti = new Map((esistenti ?? []).map(e => [e.nome.toLowerCase().trim(), e.id]))
  console.log(`Già presenti in eventi: ${nomiEsistenti.size}\n`)

  let inseriti = 0, aggiornati = 0, percorsiInseriti = 0, saltati = 0
  const doppioni = new Set()

  for (const ev of ricercati) {
    const nomeKey = ev.nome.toLowerCase().trim()
    if (doppioni.has(nomeKey)) { console.log(`  ⚠ Doppione saltato: ${ev.nome}`); saltati++; continue }
    doppioni.add(nomeKey)

    const idEsistente = nomiEsistenti.get(nomeKey)

    if (idEsistente) {
      await sb.from('eventi').update({ attivo: ev.attivo ?? true, stato: 'ricercato',
        luogo: ev.luogo ?? undefined, url: ev.url ?? undefined,
        immagine_url: ev.immagine_url ?? undefined, tipologia: ev.tipologia ?? undefined,
        data_fine: ev.data_fine ?? undefined, ultimo_controllo: ev.ultimo_controllo ?? undefined,
      }).eq('id', idEsistente)

      const { count } = await sb.from('percorsi').select('id', { count: 'exact', head: true }).eq('evento_id', idEsistente)
      if ((count ?? 0) === 0 && Array.isArray(ev.percorsi) && ev.percorsi.length > 0) {
        const rows = ev.percorsi.map(p => ({ evento_id: idEsistente, nome_percorso: p.nome ?? 'Percorso unico', km: p.km ?? null, dislivello_m: p.dislivello ?? null, tipologia_id: p.tipologia ? (TIPOLOGIA_ID_MAP[p.tipologia] ?? null) : null }))
        const { error: ep } = await sb.from('percorsi').insert(rows)
        if (!ep) percorsiInseriti += rows.length
      }
      aggiornati++
      console.log(`  ↺ Aggiornato (esiste già): ${ev.nome}`)
    } else {
      const { data: nuovoEv, error: errI } = await sb.from('eventi').insert({
        nome: ev.nome.trim(), data_evento: ev.data ?? null, data_fine: ev.data_fine ?? null,
        luogo: ev.luogo ?? null, tipologia: ev.tipologia ?? null, url: ev.url ?? null,
        immagine_url: ev.immagine_url ?? null, attivo: ev.attivo ?? true, stato: 'ricercato',
        ultimo_controllo: ev.ultimo_controllo ?? null,
      }).select('id').single()

      if (errI) { console.error(`  ✗ Errore "${ev.nome}":`, errI.message); continue }
      inseriti++
      nomiEsistenti.set(nomeKey, nuovoEv.id)
      console.log(`  + Inserito: ${ev.nome} (id=${nuovoEv.id})`)

      if (Array.isArray(ev.percorsi) && ev.percorsi.length > 0) {
        const rows = ev.percorsi.map(p => ({ evento_id: nuovoEv.id, nome_percorso: p.nome ?? 'Percorso unico', km: p.km ?? null, dislivello_m: p.dislivello ?? null, tipologia_id: p.tipologia ? (TIPOLOGIA_ID_MAP[p.tipologia] ?? null) : null }))
        const { error: ep } = await sb.from('percorsi').insert(rows)
        if (!ep) { percorsiInseriti += rows.length; console.log(`    → ${rows.length} percorso/i`) }
        else console.error(`    ✗ Percorsi:`, ep.message)
      }
    }
  }

  console.log('\n=== Risultato ===')
  console.log(`  Inseriti: ${inseriti} | Aggiornati: ${aggiornati} | Doppioni saltati: ${saltati} | Percorsi: ${percorsiInseriti}`)
  console.log('\nSQL da eseguire su Supabase dopo la verifica:')
  console.log('ALTER TABLE eventi ADD CONSTRAINT IF NOT EXISTS eventi_nome_data_unique UNIQUE (nome, data_evento);')
}

main().catch(console.error)

/**
 * fix-tipologie.mjs
 * Script one-shot per correggere retroattivamente le tipologie errate nel DB.
 * Applica le regole deterministiche per keyword a tutti gli eventi esistenti.
 * 
 * Uso: node scripts/fix-tipologie.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Leggi env
let env = {}
try {
  const raw = readFileSync('.env.local', 'utf8')
  raw.split('\n').forEach(line => {
    const [k, ...v] = line.split('=')
    if (k && v.length) env[k.trim()] = v.join('=').trim()
  })
} catch {}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Variabili NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY non trovate in .env.local')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Logica di classificazione (replica di classifica-tipologia.ts) ──────────

function classificaPerKeyword(nome, dominioUrl, kmMax) {
  const n = nome.toLowerCase()
  const d = (dominioUrl ?? '').toLowerCase()

  if (d.includes('gravelland') || n.includes('gravelland')) return 'Gravel di GRAvellAND'
  
  const isRandonnee = n.includes('randonn') || n.includes('audax') || n.includes('brevet')
  if (isRandonnee && kmMax != null) {
    return kmMax <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
  }
  
  if (n.includes('gran fondo') || n.includes('granfondo') || n.includes('medio fondo') || n.includes('mediofondo')) return 'Gran/Medio Fondo'
  if (n.includes('ciclocross') || n.includes('cyclocross')) return 'Ciclocross'
  if (n.includes(' mtb') || n.startsWith('mtb') || n.includes('mountain bike') || n.includes('mountainbike')) return 'MTB'
  if (n.includes('trail') && !n.includes('gravel')) return 'Trail'
  if ((n.includes('pedalata') || n.includes('cicloturistic')) && !n.includes('gran fondo') && !n.includes('gara')) return 'Pedalata Cicloturistica'
  if (n.includes('criterium') || n.includes('criterum')) return 'Gara in Circuito (CRIT)'
  if (n.includes('gravel') && !n.includes('gravelland')) return 'Gravel'
  if (n.includes('brontolo')) return 'Brontolo Bike Day'
  if (n.includes('uva') || n.includes('fragola')) return 'Uva Fragola'
  
  return null
}

function validaTipologia(nome, tipologiaAttuale, dominioUrl, kmMax) {
  if (!tipologiaAttuale) return null
  const n = nome.toLowerCase()
  const d = (dominioUrl ?? '').toLowerCase()
  const t = tipologiaAttuale.toLowerCase()

  if (d.includes('gravelland') || n.includes('gravelland')) return 'Gravel di GRAvellAND'
  if (n.includes('trail') && !n.includes('gravel') && !t.includes('trail')) return 'Trail'
  if ((n.includes('gran fondo') || n.includes('granfondo') || n.includes('medio fondo')) && !t.includes('gran')) return 'Gran/Medio Fondo'
  if ((n.includes(' mtb') || n.startsWith('mtb') || n.includes('mountain bike')) && !t.includes('mtb')) return 'MTB'
  if ((n.includes('ciclocross') || n.includes('cyclocross')) && !t.includes('ciclocross')) return 'Ciclocross'
  if (t.includes('randonn') && kmMax != null) {
    return kmMax <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
  }
  return tipologiaAttuale
}

function getDominio(url) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔍 Carico tutti gli eventi dal DB...')
  const { data: eventi, error } = await sb
    .from('eventi_ricercati')
    .select('id, nome, tipologia, url, percorsi')
    .eq('attivo', true)
    .order('id')

  if (error) { console.error('Errore DB:', error.message); process.exit(1) }
  console.log(`📋 ${eventi.length} eventi attivi trovati\n`)

  let corretti = 0
  let invariati = 0
  const correzioni = []

  for (const ev of eventi) {
    const dominio = getDominio(ev.url ?? '')
    const percorsi = Array.isArray(ev.percorsi) ? ev.percorsi : []
    const kmMax = percorsi.length > 0
      ? Math.max(...percorsi.map(p => p.km ?? 0))
      : null

    // Prova keyword deterministiche
    const nuovaTipologia =
      classificaPerKeyword(ev.nome, dominio, kmMax) ??
      validaTipologia(ev.nome, ev.tipologia, dominio, kmMax)

    // Correggi anche le tipologie dei percorsi
    const nuoviPercorsi = percorsi.map(p => {
      const kmP = p.km ?? null
      const dominioP = dominio
      const nuovaTipP = classificaPerKeyword(p.nome ?? ev.nome, dominioP, kmP)
        ?? validaTipologia(p.nome ?? ev.nome, p.tipologia, dominioP, kmP)
      if (nuovaTipP && nuovaTipP !== p.tipologia) {
        return { ...p, tipologia: nuovaTipP }
      }
      return p
    })

    const tipologiaCambiata = nuovaTipologia && nuovaTipologia !== ev.tipologia
    const percorsiCambiati = JSON.stringify(nuoviPercorsi) !== JSON.stringify(percorsi)

    if (tipologiaCambiata || percorsiCambiati) {
      correzioni.push({
        id: ev.id,
        nome: ev.nome,
        da: ev.tipologia ?? '(nessuna)',
        a: nuovaTipologia ?? ev.tipologia ?? '(nessuna)',
      })

      const update = {}
      if (tipologiaCambiata) update.tipologia = nuovaTipologia
      if (percorsiCambiati) update.percorsi = nuoviPercorsi

      const { error: errUpd } = await sb
        .from('eventi_ricercati')
        .update(update)
        .eq('id', ev.id)

      if (errUpd) {
        console.error(`❌ Errore aggiornamento ${ev.nome}:`, errUpd.message)
      } else {
        corretti++
      }
    } else {
      invariati++
    }
  }

  console.log('=== RISULTATI FIX RETROATTIVO ===')
  if (correzioni.length === 0) {
    console.log('✅ Nessuna correzione necessaria — tutte le tipologie sono già corrette!')
  } else {
    console.log(`\n📝 ${corretti} eventi corretti:\n`)
    correzioni.forEach(c => {
      console.log(`  • ${c.nome}`)
      console.log(`    "${c.da}" → "${c.a}"\n`)
    })
  }
  console.log(`\n✅ Corretti: ${corretti} | ⏭️ Invariati: ${invariati}`)
}

main().catch(console.error)

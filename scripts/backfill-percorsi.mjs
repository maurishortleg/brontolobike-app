/**
 * Script locale per completare km/dislivello degli eventi con percorsi incompleti.
 * Esegui con: node scripts/backfill-percorsi.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Carica .env.local
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dir, '..', '.env.local')
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY
const GOOGLE_KEY = env.GOOGLE_AI_API_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !GOOGLE_KEY) {
  console.error('❌ Variabili mancanti in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_AI_API_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

const TIPOLOGIE = [
  'Bike Camp Livigno', 'Brevetto Permanente Gravel', 'Brevetto Permanente Strada',
  'Brontolo Bike Day', 'Ciclocross', 'Gara in Circuito (CRIT)', 'Gran/Medio Fondo',
  'Gravel', 'Gravel di GRAvellAND', 'MTB', 'Pedalata Cicloturistica',
  'Percorso con Credenziale', 'Randonnée fino a 120Km', 'Randonnée oltre i 120Km',
  'Trail', 'Uva Fragola',
]
const tipologieStr = TIPOLOGIE.map(t => `"${t}"`).join(', ')

async function fetchTesto(url) {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrontoloBike-bot/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 15000)
  } catch (e) {
    return null
  }
}

async function geminiCall(prompt, tentativo = 0) {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GOOGLE_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(30000),
      }
    )
    if (res.status === 429 && tentativo < 4) {
      const attesa = 3000 * Math.pow(2, tentativo)
      console.log(`  ⏳ Rate limit Gemini, attendo ${attesa / 1000}s...`)
      await new Promise(r => setTimeout(r, attesa))
      return geminiCall(prompt, tentativo + 1)
    }
    if (!res.ok) { console.log(`  ⚠️  Gemini HTTP ${res.status}`); return null }
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null
  } catch (e) {
    console.log(`  ⚠️  Gemini errore: ${e.message}`)
    return null
  }
}

async function main() {
  console.log('🔍 Carico eventi con percorsi incompleti...')

  const { data: eventi, error } = await supabase
    .from('eventi_ricercati')
    .select('id, nome, url, tipologia, percorsi')
    .eq('attivo', true)

  if (error) { console.error('❌ Errore Supabase:', error.message); process.exit(1) }

  const daAggiornare = (eventi ?? []).filter(ev =>
    !ev.percorsi?.length || ev.percorsi.some(p => p.km == null)
  )

  console.log(`📋 Trovati ${daAggiornare.length} eventi con percorsi incompleti su ${eventi.length} totali\n`)

  if (daAggiornare.length === 0) { console.log('✅ Tutti i percorsi sono già completi!'); return }

  let aggiornati = 0
  let falliti = 0

  for (let i = 0; i < daAggiornare.length; i++) {
    const ev = daAggiornare[i]
    console.log(`[${i + 1}/${daAggiornare.length}] ${ev.nome}`)

    if (!ev.url) { console.log('  ⚠️  Nessun URL\n'); falliti++; continue }

    const testo = await fetchTesto(ev.url)
    if (!testo) { console.log('  ⚠️  Pagina non raggiungibile\n'); falliti++; continue }

    console.log(`  📄 Pagina: ${testo.length} caratteri → chiedo a Gemini...`)

    const prompt = `Dal testo della pagina web dell'evento ciclistico "${ev.nome}", estrai TUTTI i percorsi disponibili.

Per ogni percorso crea un oggetto JSON con:
- nome: nome ufficiale del percorso
- km: distanza in km (numero intero), null se non trovata
- dislivello: dislivello in metri (numero intero), null se non trovato
- tipologia: scegli da: ${tipologieStr} — oppure null

Regole:
- Cerca TUTTE le distanze disponibili (es. SHORT 200, CLASSIC 300, WILD 400, 60km, 120km ecc.)
- km e dislivello possono apparire come "300 km / 4600 D+" o "4600 m D+" o simili
- Restituisci SOLO un array JSON valido, senza markdown, senza testo aggiuntivo

TESTO PAGINA:
${testo}`

    const text = await geminiCall(prompt)
    if (!text) { console.log('  ❌ Gemini non ha risposto\n'); falliti++; continue }

    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
      const percorsi = JSON.parse(cleaned)
      if (!Array.isArray(percorsi) || percorsi.length === 0) {
        console.log('  ⚠️  Nessun percorso estratto\n'); falliti++; continue
      }

      const { error: updateError } = await supabase
        .from('eventi_ricercati')
        .update({ percorsi })
        .eq('id', ev.id)

      if (updateError) {
        console.log(`  ❌ Errore salvataggio: ${updateError.message}\n`); falliti++; continue
      }

      console.log(`  ✅ ${percorsi.length} percorsi salvati: ${percorsi.map(p => `${p.nome} ${p.km}km`).join(', ')}\n`)
      aggiornati++
    } catch {
      console.log('  ❌ JSON non valido\n'); falliti++
    }

    // Pausa tra eventi per non saturare Gemini
    if (i < daAggiornare.length - 1) await new Promise(r => setTimeout(r, 1500))
  }

  console.log(`\n🏁 Completato: ${aggiornati} aggiornati, ${falliti} falliti`)
}

main()

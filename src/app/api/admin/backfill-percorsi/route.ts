import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { isAdmin } from '@/lib/is-admin'

const TIPOLOGIE = [
  'Bike Camp Livigno', 'Brevetto Permanente Gravel', 'Brevetto Permanente Strada',
  'Brontolo Bike Day', 'Ciclocross', 'Gara in Circuito (CRIT)', 'Gran/Medio Fondo',
  'Gravel', 'Gravel di GRAvellAND', 'MTB', 'Pedalata Cicloturistica',
  'Percorso con Credenziale', 'Randonnée fino a 120Km', 'Randonnée oltre i 120Km',
  'Trail', 'Uva Fragola',
]

export const maxDuration = 60

async function fetchTesto(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
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
      .slice(0, 12000)
  } catch {
    return null
  }
}

async function geminiCall(googleKey: string, prompt: string): Promise<string> {
  let attesa = 3000
  for (let i = 0; i < 4; i++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(25000),
      }
    )
    if (res.status === 429) {
      if (i < 3) await new Promise((r) => setTimeout(r, attesa))
      attesa *= 2
      continue
    }
    if (!res.ok) return ''
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
  }
  return ''
}

export async function GET(_req: NextRequest) {
  try {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!isAdmin(user)) return Response.json({ error: 'Non autorizzato' }, { status: 403 })

  const googleKey = process.env.GOOGLE_AI_API_KEY
  if (!googleKey) return Response.json({ error: 'GOOGLE_AI_API_KEY mancante' }, { status: 500 })

  const tipologieStr = TIPOLOGIE.map((t) => `"${t}"`).join(', ')

  // Carica eventi con percorsi vuoti o con km null
  const { data: eventi } = await supabase
    .from('eventi_ricercati')
    .select('id, nome, url, tipologia, percorsi')
    .eq('attivo', true)

  if (!eventi?.length) return Response.json({ messaggio: 'Nessun evento trovato', aggiornati: 0 })

  const daAggiornare = eventi.filter((ev) =>
    !ev.percorsi?.length || ev.percorsi.some((p: { km: number | null }) => p.km == null)
  )

  if (!daAggiornare.length) return Response.json({ messaggio: 'Tutti i percorsi sono già completi', aggiornati: 0 })

  const admin = createSupabaseAdminClient()
  const log: string[] = []
  let aggiornati = 0

  // Limite: max 20 eventi per chiamata per non superare il timeout di 60s
  const lotto = daAggiornare.slice(0, 20)

  for (const ev of lotto) {
    if (!ev.url) { log.push(`⚠️ ${ev.nome}: nessun URL`); continue }

    const testo = await fetchTesto(ev.url)
    if (!testo) { log.push(`⚠️ ${ev.nome}: pagina non raggiungibile`); continue }

    await new Promise((r) => setTimeout(r, 1500))

    const prompt = `Dal testo della pagina web dell'evento ciclistico "${ev.nome}", estrai TUTTI i percorsi disponibili.

Per ogni percorso crea un oggetto con:
- nome: nome ufficiale del percorso
- km: distanza in km (numero intero), null se non trovata
- dislivello: dislivello in metri (numero intero), null se non trovato
- tipologia: scegli da: ${tipologieStr} — oppure null

Regole:
- Cerca tutte le distanze disponibili (es. SHORT 200, CLASSIC 300, WILD 400, 60km, 120km, ecc.)
- km e dislivello possono essere scritti come "300 km / 4600 D+" o "4600 m D+" o simili
- Restituisci SOLO un array JSON valido senza markdown, senza testo aggiuntivo

TESTO PAGINA:
${testo}`

    const text = await geminiCall(googleKey, prompt)
    if (!text) { log.push(`⚠️ ${ev.nome}: Gemini non ha risposto`); continue }

    try {
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
      const percorsi = JSON.parse(cleaned)
      if (!Array.isArray(percorsi) || percorsi.length === 0) {
        log.push(`⚠️ ${ev.nome}: nessun percorso estratto`)
        continue
      }

      await admin.from('eventi_ricercati').update({ percorsi }).eq('id', ev.id)
      log.push(`✅ ${ev.nome}: ${percorsi.length} percorsi aggiornati`)
      aggiornati++
    } catch {
      log.push(`❌ ${ev.nome}: JSON non valido`)
    }
  }

  const rimanenti = daAggiornare.length - lotto.length
  if (rimanenti > 0) log.push(`ℹ️ ${rimanenti} eventi rimanenti — rilancia per continuare`)

  return Response.json({ messaggio: `${aggiornati} eventi aggiornati`, log })
  } catch (e) {
    return Response.json({ error: `Errore interno: ${e}` }, { status: 500 })
  }
}

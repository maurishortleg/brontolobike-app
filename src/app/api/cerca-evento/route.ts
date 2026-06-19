import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Aggiungi o rimuovi siti da cercare preferenzialmente
const SITI_PREFERENZIALI = [
  'gravelland.it',
  'battistrada.com',
  'audaxitalia.it',
  'granfondo.it',
  'endu.net',
]

// Deve corrispondere esattamente ai nomi nella tabella tipologie_evento
const TIPOLOGIE = [
  'Bike Camp Livigno',
  'Brevetto Permanente Gravel',
  'Brevetto Permanente Strada',
  'Brontolo Bike Day',
  'Ciclocross',
  'Gara in Circuito (CRIT)',
  'Gran/Medio Fondo',
  'Gravel',
  'Gravel di GRAvelAND',
  'MTB',
  'Pedalata Cicloturistica',
  'Percorso con Credenziale',
  'Randonnée fino a 120Km',
  'Randonnée oltre i 120Km',
  'Trail',
  'Uva Fragola',
]

export type PercorsoTrovato = {
  nome: string
  km: number
  dislivello: number | null
  tipologia: string | null
}

export type EventoTrovato = {
  nome: string
  data: string | null
  tipologia: string | null
  url: string
  percorsi: PercorsoTrovato[]
}

function dominioUrl(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

export async function POST(req: NextRequest) {
  const { query } = await req.json()

  if (!query?.trim()) {
    return Response.json({ error: 'Query mancante' }, { status: 400 })
  }

  const tavilyKey = process.env.TAVILY_API_KEY
  if (!tavilyKey) {
    return Response.json({ error: 'Chiave API di ricerca non configurata' }, { status: 500 })
  }

  const tavilyRes = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: tavilyKey,
      query: `${query} ciclismo percorsi km dislivello`,
      search_depth: 'advanced',
      max_results: 8,
      include_answer: false,
      include_domains: SITI_PREFERENZIALI,
    }),
  })

  let tavilyData = tavilyRes.ok ? await tavilyRes.json() : { results: [] }
  if ((tavilyData.results ?? []).length === 0) {
    const fallbackRes = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `${query} ciclismo percorsi km dislivello`,
        search_depth: 'advanced',
        max_results: 8,
        include_answer: false,
      }),
    })
    if (fallbackRes.ok) tavilyData = await fallbackRes.json()
  }

  const results: { title: string; url: string; content: string }[] = tavilyData.results ?? []

  if (results.length === 0) {
    return Response.json({ risultati: [] })
  }

  const googleKey = process.env.GOOGLE_AI_API_KEY
  if (!googleKey) {
    return Response.json({ risultati: [] })
  }

  const textResults = results
    .map((r) => `TITOLO: ${r.title}\nURL: ${r.url}\nCONTENUTO: ${r.content}`)
    .join('\n\n---\n\n')

  const tipologieStr = TIPOLOGIE.map((t) => `"${t}"`).join(', ')

  const prompt = `Dai seguenti risultati di ricerca su eventi ciclistici, estrai una lista di eventi in formato JSON.

Per ogni evento trovato, crea un oggetto con:
- nome: nome completo dell'evento (stringa)
- data: data in formato YYYY-MM-DD se trovata, altrimenti null
- tipologia: tipologia prevalente dell'evento, scelta da questa lista: ${tipologieStr} — oppure null
- url: URL del sito più autorevole (preferisci il sito ufficiale dell'evento, poi siti specializzati)
- percorsi: array con TUTTI i percorsi disponibili per quell'evento. Ogni percorso ha:
  - nome: nome ESATTO del percorso come riportato dall'evento (es. "GravelLong", "GravelShort", "103 km Gravel", "65 km MTB") — NON usare nomi generici come "Lungo", "Medio", "Corto" a meno che non siano i nomi ufficiali dell'evento
  - km: chilometri come numero intero
  - dislivello: dislivello in metri come numero intero, null se non trovato
  - tipologia: tipologia specifica di questo percorso (può differire dall'evento principale), scelta dalla stessa lista: ${tipologieStr} — oppure null

Regole importanti:
- Se lo stesso evento appare su più siti, tienilo una volta sola usando l'URL più autorevole
- Cerca TUTTI i percorsi disponibili, anche se sono più di tre
- Se un percorso ha tipologia diversa dagli altri (es. uno Gravel e uno MTB), indicalo nel campo tipologia del percorso

Restituisci SOLO un array JSON valido, senza markdown, senza testo aggiuntivo. Massimo 4 eventi distinti. Se non trovi eventi chiari, restituisci [].

RISULTATI:
${textResults}`

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  )

  if (!geminiRes.ok) {
    const errText = await geminiRes.text()
    console.error('Gemini error:', errText)
    return Response.json({ risultati: [] })
  }

  const geminiData = await geminiRes.json()
  const text: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''

  if (!text) return Response.json({ risultati: [] })

  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()

  let risultati: EventoTrovato[] = []
  try {
    let parsed = JSON.parse(cleaned) as EventoTrovato[]
    if (!Array.isArray(parsed)) return Response.json({ risultati: [] })

    // Forza tipologia "Gravel di GRAvelAND" per eventi da gravelland.it
    parsed = parsed.map((ev) => {
      const dominio = dominioUrl(ev.url)
      if (dominio === 'gravelland.it') {
        return {
          ...ev,
          tipologia: 'Gravel di GRAvelAND',
          percorsi: ev.percorsi.map((p) => ({
            ...p,
            tipologia: p.tipologia === 'Gravel' ? 'Gravel di GRAvelAND' : (p.tipologia ?? 'Gravel di GRAvelAND'),
          })),
        }
      }
      return ev
    })

    risultati = parsed
  } catch {
    return Response.json({ risultati: [] })
  }

  // Salva i risultati nel database per autocomplete futuro
  if (risultati.length > 0) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const righe = risultati.map((ev) => ({
        nome: ev.nome,
        data: ev.data,
        tipologia: ev.tipologia,
        url: ev.url,
        percorsi: ev.percorsi,
      }))
      // Inserisce solo se l'evento non esiste già (stesso nome e stessa data)
      for (const riga of righe) {
        const { data: esistente } = await supabase
          .from('eventi_ricercati')
          .select('id')
          .ilike('nome', riga.nome)
          .eq('data', riga.data ?? '')
          .maybeSingle()
        if (!esistente) {
          await supabase.from('eventi_ricercati').insert(riga)
        }
      }
    } catch (e) {
      console.error('Errore salvataggio DB eventi:', e)
    }
  }

  return Response.json({ risultati })
}

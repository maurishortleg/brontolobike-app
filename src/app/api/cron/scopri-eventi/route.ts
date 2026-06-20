import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANNO = new Date().getFullYear()

const FONTI: { nome: string; dominio: string; url: string; query: string }[] = [
  {
    nome: 'Audax Italia',
    dominio: 'audaxitalia.it',
    url: 'https://www.audaxitalia.it/',
    query: `site:audaxitalia.it calendario brevetti randonnee ${ANNO}`,
  },
  {
    nome: 'GravelLand',
    dominio: 'gravelland.it',
    url: 'https://www.gravelland.it/',
    query: `site:gravelland.it calendario gravel eventi ${ANNO}`,
  },
  {
    nome: 'Endu',
    dominio: 'endu.net',
    url: 'https://www.endu.net/',
    query: `site:endu.net calendario ciclismo granfondo gravel ${ANNO} lombardia`,
  },
  {
    nome: 'Battistrada',
    dominio: 'battistrada.com',
    url: 'https://battistrada.com/en/cycling-calendar/',
    query: `site:battistrada.com cycling calendar events ${ANNO} italy`,
  },
  {
    nome: 'Granfondo',
    dominio: 'granfondo.it',
    url: 'https://www.granfondo.it/',
    query: `site:granfondo.it calendario gare granfondo ${ANNO}`,
  },
]

const TIPOLOGIE = [
  'Bike Camp Livigno', 'Brevetto Permanente Gravel', 'Brevetto Permanente Strada',
  'Brontolo Bike Day', 'Ciclocross', 'Gara in Circuito (CRIT)', 'Gran/Medio Fondo',
  'Gravel', 'Gravel di GRAvelAND', 'MTB', 'Pedalata Cicloturistica',
  'Percorso con Credenziale', 'Randonnée fino a 120Km', 'Randonnée oltre i 120Km',
  'Trail', 'Uva Fragola',
]

function dominioUrl(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

function correggiRandonnee(tipologia: string | null, km: number | null): string | null {
  if (!tipologia?.toLowerCase().includes('randonn')) return tipologia
  if (km == null) return tipologia
  return km <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const tavilyKey = process.env.TAVILY_API_KEY
  const googleKey = process.env.GOOGLE_AI_API_KEY
  if (!tavilyKey || !googleKey) {
    return Response.json({ error: 'Chiavi API mancanti' }, { status: 500 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const tipologieStr = TIPOLOGIE.map((t) => `"${t}"`).join(', ')
  const log: string[] = []
  let nuovi = 0

  for (const fonte of FONTI) {
    try {
      // Cerca eventi sul sito tramite Tavily
      const tavilyRes = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: tavilyKey,
          query: fonte.query,
          search_depth: 'advanced',
          max_results: 10,
          include_answer: false,
          include_domains: [fonte.dominio],
        }),
      })

      if (!tavilyRes.ok) {
        log.push(`⚠️ ${fonte.nome}: errore Tavily ${tavilyRes.status}`)
        continue
      }

      const tavilyData = await tavilyRes.json()
      const results: { title: string; url: string; content: string }[] = tavilyData.results ?? []

      if (results.length === 0) {
        log.push(`⚠️ ${fonte.nome}: nessun risultato Tavily`)
        continue
      }

      const textResults = results
        .map((r) => `TITOLO: ${r.title}\nURL: ${r.url}\nCONTENUTO: ${r.content}`)
        .join('\n\n---\n\n')

      const prompt = `Dai seguenti risultati del sito "${fonte.nome}" (${fonte.url}), estrai tutti gli eventi ciclistici del ${ANNO}.

Per ogni evento crea un oggetto con:
- nome: nome completo dell'evento
- data: data inizio YYYY-MM-DD, null se non trovata
- data_fine: data fine YYYY-MM-DD per eventi multi-giorno, null altrimenti
- luogo: città o paese di partenza, null se non trovato
- tipologia: scegli da: ${tipologieStr} — oppure null
- url: URL diretto all'evento (preferisci pagina specifica, non homepage)
- percorsi: array con tutti i percorsi { nome, km (numero), dislivello (numero o null), tipologia (dalla lista o null) }

Regole:
- Includi solo eventi del ${ANNO} o futuri
- Se lo stesso evento appare più volte, tienilo una volta sola
- Se non hai km o percorsi, metti percorsi: []
- Per GravelLand usa sempre tipologia "Gravel di GRAvelAND"
- Per Audax/brevetti usa "Randonnée fino a 120Km" o "Randonnée oltre i 120Km" in base ai km

Restituisci SOLO un array JSON valido senza markdown. Se non trovi eventi restituisci [].

RISULTATI:
${textResults}`

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
      )

      if (!geminiRes.ok) {
        log.push(`⚠️ ${fonte.nome}: errore Gemini ${geminiRes.status}`)
        continue
      }

      const geminiData = await geminiRes.json()
      const text: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()

      let eventi: {
        nome: string; data: string | null; data_fine: string | null
        luogo: string | null; tipologia: string | null; url: string
        percorsi: { nome: string; km: number; dislivello: number | null; tipologia: string | null }[]
      }[]

      try {
        const parsed = JSON.parse(cleaned)
        eventi = Array.isArray(parsed) ? parsed : []
      } catch {
        log.push(`⚠️ ${fonte.nome}: JSON non valido`)
        continue
      }

      let nuoviPerFonte = 0
      for (const ev of eventi) {
        if (!ev.nome?.trim()) continue

        // Applica correzioni tipologia
        const dominio = dominioUrl(ev.url ?? '')
        if (dominio === 'gravelland.it') {
          ev.tipologia = 'Gravel di GRAvelAND'
          ev.percorsi = ev.percorsi?.map((p) => ({
            ...p,
            tipologia: 'Gravel di GRAvelAND',
          })) ?? []
        } else {
          const kmMax = ev.percorsi?.length > 0
            ? Math.max(...ev.percorsi.map((p) => p.km ?? 0))
            : null
          ev.tipologia = correggiRandonnee(ev.tipologia, kmMax) ?? ev.tipologia
          ev.percorsi = ev.percorsi?.map((p) => ({
            ...p,
            tipologia: correggiRandonnee(p.tipologia ?? ev.tipologia, p.km) ?? p.tipologia,
          })) ?? []
        }

        // Controlla se esiste già (per nome, case-insensitive)
        const { data: esistente } = await supabase
          .from('eventi_ricercati')
          .select('id')
          .ilike('nome', ev.nome.trim())
          .maybeSingle()

        if (!esistente) {
          await supabase.from('eventi_ricercati').insert({
            nome: ev.nome.trim(),
            data: ev.data ?? null,
            data_fine: ev.data_fine ?? null,
            luogo: ev.luogo ?? null,
            tipologia: ev.tipologia ?? null,
            url: ev.url ?? fonte.url,
            percorsi: ev.percorsi ?? [],
            attivo: true,
          })
          nuoviPerFonte++
          nuovi++
        }
      }

      log.push(`✅ ${fonte.nome}: ${eventi.length} eventi trovati, ${nuoviPerFonte} nuovi`)
    } catch (e) {
      log.push(`❌ ${fonte.nome}: errore - ${e}`)
    }
  }

  return Response.json({
    messaggio: `Scoperta completata: ${nuovi} nuovi eventi aggiunti`,
    log,
  })
}

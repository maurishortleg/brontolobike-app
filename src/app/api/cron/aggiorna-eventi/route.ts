import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Quanti eventi controllare per ogni esecuzione (per non esaurire i crediti Tavily)
const MAX_EVENTI_PER_RUN = 5

// Giorni minimi tra un controllo e l'altro per lo stesso evento
const GIORNI_TRA_CONTROLLI = 7

type PercorsoTrovato = {
  nome: string
  km: number
  dislivello: number | null
  tipologia: string | null
}

type EventoAggiornato = {
  nome: string
  data: string | null
  tipologia: string | null
  url: string
  percorsi: PercorsoTrovato[]
}

const TIPOLOGIE = [
  'Bike Camp Livigno', 'Brevetto Permanente Gravel', 'Brevetto Permanente Strada',
  'Brontolo Bike Day', 'Ciclocross', 'Gara in Circuito (CRIT)', 'Gran/Medio Fondo',
  'Gravel', 'Gravel di GRAvelAND', 'MTB', 'Pedalata Cicloturistica',
  'Percorso con Credenziale', 'Randonnée fino a 120Km', 'Randonnée oltre i 120Km',
  'Trail', 'Uva Fragola',
]

const SITI_PREFERENZIALI = [
  'gravelland.it', 'battistrada.com', 'audaxitalia.it', 'granfondo.it', 'endu.net',
]

function dominioUrl(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

export async function GET(req: NextRequest) {
  // Verifica che la chiamata venga da Vercel Cron
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Prende gli eventi attivi non controllati di recente, ordinati dal meno recente
  const sogliaData = new Date()
  sogliaData.setDate(sogliaData.getDate() - GIORNI_TRA_CONTROLLI)

  const { data: eventiDaControllare, error } = await supabase
    .from('eventi_ricercati')
    .select('*')
    .eq('attivo', true)
    .or(`ultimo_controllo.is.null,ultimo_controllo.lt.${sogliaData.toISOString()}`)
    .order('ultimo_controllo', { ascending: true, nullsFirst: true })
    .limit(MAX_EVENTI_PER_RUN)

  if (error || !eventiDaControllare?.length) {
    return Response.json({ messaggio: 'Nessun evento da controllare', aggiornati: 0 })
  }

  const tavilyKey = process.env.TAVILY_API_KEY
  const googleKey = process.env.GOOGLE_AI_API_KEY
  const tipologieStr = TIPOLOGIE.map((t) => `"${t}"`).join(', ')

  let aggiornati = 0
  let disattivati = 0
  const log: string[] = []

  for (const evento of eventiDaControllare) {
    try {
      // Cerca l'evento su Tavily
      let results: { title: string; url: string; content: string }[] = []

      if (tavilyKey) {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query: `${evento.nome} ciclismo percorsi km dislivello`,
            search_depth: 'advanced',
            max_results: 5,
            include_answer: false,
            include_domains: SITI_PREFERENZIALI,
          }),
        })
        if (tavilyRes.ok) {
          const td = await tavilyRes.json()
          results = td.results ?? []
        }
        // Fallback senza filtro dominio
        if (results.length === 0) {
          const fallbackRes = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: tavilyKey,
              query: `${evento.nome} ciclismo percorsi km dislivello`,
              search_depth: 'basic',
              max_results: 5,
              include_answer: false,
            }),
          })
          if (fallbackRes.ok) {
            const fd = await fallbackRes.json()
            results = fd.results ?? []
          }
        }
      }

      // Se non troviamo nulla, segniamo l'evento come da verificare
      if (results.length === 0) {
        await supabase
          .from('eventi_ricercati')
          .update({ attivo: false, ultimo_controllo: new Date().toISOString() })
          .eq('id', evento.id)
        disattivati++
        log.push(`❌ ${evento.nome}: nessun risultato trovato, disattivato`)
        continue
      }

      // Se troviamo risultati, chiediamo a Gemini di estrarre i dati aggiornati
      if (!googleKey) {
        await supabase
          .from('eventi_ricercati')
          .update({ ultimo_controllo: new Date().toISOString() })
          .eq('id', evento.id)
        continue
      }

      const textResults = results
        .map((r) => `TITOLO: ${r.title}\nURL: ${r.url}\nCONTENUTO: ${r.content}`)
        .join('\n\n---\n\n')

      const prompt = `Dai seguenti risultati di ricerca, estrai i dati aggiornati per l'evento "${evento.nome}" in formato JSON.

Restituisci UN SOLO oggetto JSON con:
- nome: nome aggiornato dell'evento
- data: data in formato YYYY-MM-DD se trovata, altrimenti null
- tipologia: scegli da: ${tipologieStr} — oppure null
- url: URL più autorevole
- percorsi: array di tutti i percorsi con { nome, km, dislivello, tipologia }
- cancellato: true se l'evento risulta cancellato o non si terrà più, altrimenti false

Restituisci SOLO JSON valido, senza markdown.

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
        await supabase
          .from('eventi_ricercati')
          .update({ ultimo_controllo: new Date().toISOString() })
          .eq('id', evento.id)
        continue
      }

      const geminiData = await geminiRes.json()
      const text: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()

      let parsed: EventoAggiornato & { cancellato?: boolean }
      try {
        parsed = JSON.parse(cleaned)
      } catch {
        await supabase
          .from('eventi_ricercati')
          .update({ ultimo_controllo: new Date().toISOString() })
          .eq('id', evento.id)
        continue
      }

      if (parsed.cancellato) {
        await supabase
          .from('eventi_ricercati')
          .update({ attivo: false, ultimo_controllo: new Date().toISOString() })
          .eq('id', evento.id)
        disattivati++
        log.push(`🚫 ${evento.nome}: segnato come cancellato`)
        continue
      }

      // Applica regola GRAvelAND
      if (dominioUrl(parsed.url ?? '') === 'gravelland.it') {
        parsed.tipologia = 'Gravel di GRAvelAND'
        parsed.percorsi = parsed.percorsi?.map((p) => ({
          ...p,
          tipologia: p.tipologia === 'Gravel' ? 'Gravel di GRAvelAND' : (p.tipologia ?? 'Gravel di GRAvelAND'),
        })) ?? []
      }

      await supabase
        .from('eventi_ricercati')
        .update({
          nome: parsed.nome ?? evento.nome,
          data: parsed.data ?? evento.data,
          tipologia: parsed.tipologia ?? evento.tipologia,
          url: parsed.url ?? evento.url,
          percorsi: parsed.percorsi ?? evento.percorsi,
          attivo: true,
          ultimo_controllo: new Date().toISOString(),
        })
        .eq('id', evento.id)

      aggiornati++
      log.push(`✅ ${evento.nome}: aggiornato`)
    } catch (e) {
      log.push(`⚠️ ${evento.nome}: errore - ${e}`)
    }
  }

  return Response.json({
    messaggio: `Controllo completato: ${aggiornati} aggiornati, ${disattivati} disattivati`,
    log,
  })
}

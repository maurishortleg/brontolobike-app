import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  classificaPerKeyword,
  correggiRandonnee,
  validaTipologia,
  TIPOLOGIE_DESCRIZIONI,
} from '@/lib/classifica-tipologia'

const MAX_EVENTI_PER_RUN = 5
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
  luogo: string | null
  tipologia: string | null
  url: string
  percorsi: PercorsoTrovato[]
  cancellato?: boolean
}

const SITI_PREFERENZIALI = [
  'gravelland.it', 'battistrada.com', 'audaxitalia.it', 'granfondo.it', 'endu.net',
]

function dominioUrl(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

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

  let aggiornati = 0
  let disattivati = 0
  const log: string[] = []

  for (const evento of eventiDaControllare) {
    try {
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

      if (results.length === 0) {
        await supabase
          .from('eventi_ricercati')
          .update({ attivo: false, ultimo_controllo: new Date().toISOString() })
          .eq('id', evento.id)
        disattivati++
        log.push(`❌ ${evento.nome}: nessun risultato trovato, disattivato`)
        continue
      }

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

      // ── Prompt migliorato con descrizioni e disambiguazione ──
      const prompt = `Dai seguenti risultati di ricerca, estrai i dati aggiornati per l'evento ciclistico "${evento.nome}".

Restituisci UN SOLO oggetto JSON con:
- nome: nome aggiornato dell'evento
- data: data in formato YYYY-MM-DD se trovata, altrimenti null
- luogo: città o paese di partenza/svolgimento, null se non trovato
- tipologia: scegli dalla lista seguente
- url: URL più autorevole
- percorsi: array di tutti i percorsi con { nome, km, dislivello, tipologia }
- cancellato: true se l'evento risulta cancellato o non si terrà più, altrimenti false

${TIPOLOGIE_DESCRIZIONI}

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

      let parsed: EventoAggiornato
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

      // ── Classificazione tipologia con logica migliorata ──
      const dominio = dominioUrl(parsed.url ?? evento.url ?? '')
      const kmMax = parsed.percorsi?.length > 0
        ? Math.max(...parsed.percorsi.map((p) => p.km ?? 0))
        : null

      // 1. Prova keyword deterministiche
      const tipologiaKeyword = classificaPerKeyword(parsed.nome ?? evento.nome, dominio, kmMax)
      // 2. Se non trovata, usa Gemini + sanity check
      let tipologiaFinale = tipologiaKeyword
        ?? validaTipologia(parsed.nome ?? evento.nome, parsed.tipologia, dominio, kmMax)
        ?? correggiRandonnee(parsed.tipologia, kmMax)

      // Eredita la tipologia precedente se Gemini non ha trovato nulla
      if (!tipologiaFinale) tipologiaFinale = evento.tipologia ?? null

      // ── Correggi tipologie percorsi ──
      const isRandonnee =
        tipologiaFinale?.toLowerCase().includes('randonn') ||
        (parsed.nome ?? evento.nome).toLowerCase().includes('randonn')

      const percorsiCorretti = (parsed.percorsi ?? evento.percorsi ?? []).map((p: PercorsoTrovato) => {
        const kmP = p.km ?? null
        let tipP: string | null
        if (dominio === 'gravelland.it') {
          tipP = 'Gravel di GRAvellAND'
        } else if (isRandonnee || p.tipologia?.toLowerCase().includes('randonn')) {
          tipP = kmP != null ? (kmP <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km') : p.tipologia
        } else {
          tipP = classificaPerKeyword(p.nome ?? '', dominio, kmP)
            ?? validaTipologia(p.nome ?? '', p.tipologia, dominio, kmP)
            ?? correggiRandonnee(p.tipologia, kmP)
        }
        return { ...p, tipologia: tipP }
      })

      await supabase
        .from('eventi_ricercati')
        .update({
          nome: parsed.nome ?? evento.nome,
          data: parsed.data ?? evento.data,
          luogo: parsed.luogo ?? evento.luogo,
          tipologia: tipologiaFinale,
          url: parsed.url ?? evento.url,
          percorsi: percorsiCorretti,
          attivo: true,
          ultimo_controllo: new Date().toISOString(),
        })
        .eq('id', evento.id)

      aggiornati++
      log.push(`✅ ${evento.nome}: aggiornato (tipologia: ${tipologiaFinale ?? 'nessuna'})`)
    } catch (e) {
      log.push(`⚠️ ${evento.nome}: errore - ${e}`)
    }
  }

  return Response.json({
    messaggio: `Controllo completato: ${aggiornati} aggiornati, ${disattivati} disattivati`,
    log,
  })
}

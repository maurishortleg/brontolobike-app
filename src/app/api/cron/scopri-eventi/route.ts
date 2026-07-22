import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  classificaPerKeyword,
  correggiRandonnee,
  validaTipologia,
  TIPOLOGIE_DESCRIZIONI,
  TIPOLOGIE_STR,
} from '@/lib/classifica-tipologia'

const ANNO = new Date().getFullYear()

function dominioUrl(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

async function fetchPagina(url: string): Promise<{ html: string; testo: string } | null> {
  if (!url) return null
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BrontoloBike-bot/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()
    const testo = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 12000)
    return { html, testo }
  } catch {
    return null
  }
}

function estraiOgImage(html: string, baseUrl: string): string | null {
  const match =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
  if (!match) return null
  const src = match[1]
  if (src.startsWith('http')) return src
  try { return new URL(src, new URL(baseUrl).origin).href } catch { return null }
}

type Percorso = { nome: string; km: number | null; dislivello: number | null; tipologia: string | null }

async function geminiCall(googleKey: string, prompt: string, maxTentativi = 4): Promise<string> {
  let attesa = 3000
  for (let i = 0; i < maxTentativi; i++) {
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
      if (i < maxTentativi - 1) await new Promise((r) => setTimeout(r, attesa))
      attesa *= 2
      continue
    }
    if (!res.ok) return ''
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
  }
  return ''
}

async function arricchisciPercorsi(
  ev: { nome: string; tipologia: string | null; percorsi: Percorso[] },
  testoPageina: string,
  googleKey: string,
): Promise<Percorso[]> {
  const prompt = `Dal testo della pagina web dell'evento ciclistico "${ev.nome}", estrai TUTTI i percorsi disponibili.

Per ogni percorso crea un oggetto con:
- nome: nome ufficiale del percorso
- km: distanza in km (numero intero), null se non trovata
- dislivello: dislivello in metri (numero intero), null se non trovato
- tipologia: scegli dalla lista — oppure null

${TIPOLOGIE_DESCRIZIONI}

Regole:
- Cerca tutte le distanze (es. SHORT 200, CLASSIC 300, WILD 400, ecc.)
- I km e il dislivello possono essere scritti come "300 km / 4600 D+" o simili
- Restituisci SOLO un array JSON valido senza markdown

TESTO PAGINA:
${testoPageina}`

  try {
    const text = await geminiCall(googleKey, prompt)
    if (!text) return ev.percorsi
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    if (!Array.isArray(parsed)) return ev.percorsi
    // Valida tipologie di ogni percorso
    return parsed.map((p: Percorso) => ({
      ...p,
      tipologia: validaTipologia(p.nome ?? ev.nome, p.tipologia, null, p.km),
    }))
  } catch {
    return ev.percorsi
  }
}

export const maxDuration = 60

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

  // Carica fonti dal DB
  const { data: fontiDB, error: fontiError } = await supabase
    .from('fonti_eventi')
    .select('*')
    .eq('attiva', true)
    .order('id', { ascending: true })

  if (fontiError || !fontiDB?.length) {
    return Response.json({ error: 'Nessuna fonte configurata nel DB' }, { status: 500 })
  }

  type Fonte = { id: number; nome: string; dominio: string; url: string; queries: string[] }
  const FONTI: Fonte[] = fontiDB

  const fonteParam = req.nextUrl.searchParams.get('fonte')
  const fontiDaProcessare = fonteParam !== null
    ? [FONTI[parseInt(fonteParam)]].filter(Boolean)
    : FONTI

  const REGIONI = "Val d'Aosta, Piemonte, Liguria, Lombardia, Veneto, Trentino Alto Adige, Friuli Venezia Giulia, Emilia Romagna, Toscana, Marche, Umbria, Abruzzo, Molise, Lazio"

  const risultatiPerFonte = await Promise.all(fontiDaProcessare.map(async (fonte) => {
    const logFonte: string[] = []
    let nuoviFonte = 0
    try {
      let results: { title: string; url: string; content: string }[] = []
      for (const query of fonte.queries) {
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            api_key: tavilyKey,
            query,
            search_depth: 'basic',
            max_results: 8,
            include_answer: false,
            include_domains: [fonte.dominio],
          }),
        })
        if (!tavilyRes.ok) continue
        const d = await tavilyRes.json()
        const nuovi: { title: string; url: string; content: string }[] = d.results ?? []
        const urlEsistenti = new Set(results.map((r) => r.url))
        results = [...results, ...nuovi.filter((r) => !urlEsistenti.has(r.url))]
        if (results.length >= 8) break
      }

      if (results.length === 0) {
        logFonte.push(`⚠️ ${fonte.nome}: nessun risultato Tavily`)
        return { log: logFonte, nuovi: nuoviFonte }
      }

      const textResults = results
        .map((r) => `TITOLO: ${r.title}\nURL: ${r.url}\nCONTENUTO: ${r.content}`)
        .join('\n\n---\n\n')

      // ── Prompt migliorato con descrizioni e regole di disambiguazione ──
      const prompt = `Dai seguenti risultati del sito "${fonte.nome}" (${fonte.url}), estrai gli eventi ciclistici del ${ANNO} che si svolgono nelle seguenti regioni italiane: ${REGIONI}.

Per ogni evento crea un oggetto con:
- nome: nome completo e ufficiale dell'evento
- data: data inizio YYYY-MM-DD, null se non trovata
- data_fine: data fine YYYY-MM-DD per eventi multi-giorno, null altrimenti
- luogo: città o paese di partenza, null se non trovato
- tipologia: scegli dalla lista seguente (con descrizioni per aiutarti)
- url: URL diretto alla pagina specifica dell'evento
- percorsi: array con TUTTI i percorsi { nome, km (intero), dislivello (intero o null), tipologia }

${TIPOLOGIE_DESCRIZIONI}

Regole sugli eventi:
- Includi SOLO eventi nelle regioni: ${REGIONI}. Escludi tutto il Sud Italia
- Includi solo eventi del ${ANNO} o futuri
- Cerca TUTTI i percorsi: spesso un evento ha 3-5 distanze diverse
- Se lo stesso evento appare più volte, tienilo una volta sola con tutti i percorsi
- Per Randonnée/Audax: ogni percorso DEVE avere la tipologia corretta in base ai km (≤120 o >120)

Restituisci SOLO un array JSON valido senza markdown. Se non trovi eventi nelle regioni indicate restituisci [].

RISULTATI:
${textResults}`

      const geminiText = await geminiCall(googleKey, prompt)
      if (!geminiText) {
        logFonte.push(`⚠️ ${fonte.nome}: errore Gemini (nessuna risposta dopo retry)`)
        return { log: logFonte, nuovi: nuoviFonte }
      }

      const cleaned = geminiText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()

      let eventi: {
        nome: string; data: string | null; data_fine: string | null
        luogo: string | null; tipologia: string | null; url: string
        percorsi: Percorso[]
      }[]

      try {
        const parsed = JSON.parse(cleaned)
        eventi = Array.isArray(parsed) ? parsed : []
      } catch {
        logFonte.push(`⚠️ ${fonte.nome}: JSON non valido`)
        return { log: logFonte, nuovi: nuoviFonte }
      }

      for (const ev of eventi) {
        if (!ev.nome?.trim()) continue

        const dominio = dominioUrl(ev.url ?? '')
        const kmMax = ev.percorsi?.length > 0
          ? Math.max(...ev.percorsi.map((p) => p.km ?? 0))
          : null
        const isRandonnee =
          ev.tipologia?.toLowerCase().includes('randonn') ||
          ev.nome?.toLowerCase().includes('randonn') ||
          fonte.nome.toLowerCase().includes('audax') ||
          fonte.dominio.includes('audaxitalia')

        // ── FASE 1: Classificazione deterministica per keyword ──
        const tipologiaKeyword = classificaPerKeyword(ev.nome, dominio, kmMax)

        // ── FASE 2: Se keyword non ha trovato nulla, usa Gemini + sanity check ──
        let tipologiaFinale: string | null
        if (tipologiaKeyword) {
          tipologiaFinale = tipologiaKeyword
        } else if (isRandonnee && kmMax != null) {
          tipologiaFinale = kmMax <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
        } else {
          // Sanity check su quello che ha restituito Gemini
          tipologiaFinale = validaTipologia(ev.nome, ev.tipologia, dominio, kmMax)
          // Correzione Randonnée in base ai km
          tipologiaFinale = correggiRandonnee(tipologiaFinale, kmMax)
        }
        ev.tipologia = tipologiaFinale

        // ── Correggi tipologie dei percorsi ──
        ev.percorsi = (ev.percorsi ?? []).map((p) => {
          const kmP = p.km ?? null
          let tipP: string | null

          if (dominio === 'gravelland.it') {
            tipP = 'Gravel di GRAvellAND'
          } else if (isRandonnee || p.tipologia?.toLowerCase().includes('randonn')) {
            tipP = kmP != null
              ? (kmP <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km')
              : p.tipologia
          } else {
            // Keyword sul nome del percorso, poi sanity check
            tipP = classificaPerKeyword(p.nome ?? ev.nome, dominio, kmP)
              ?? validaTipologia(p.nome ?? ev.nome, p.tipologia ?? ev.tipologia, dominio, kmP)
              ?? correggiRandonnee(p.tipologia ?? ev.tipologia, kmP)
          }
          return { ...p, tipologia: tipP }
        })

        // ── Fetch pagina: og:image + arricchimento percorsi incompleti ──
        const percorsiIncompleti = !ev.percorsi?.length || ev.percorsi.some((p) => p.km == null)
        const pagina = ev.url ? await fetchPagina(ev.url) : null
        const immagineUrl = pagina ? estraiOgImage(pagina.html, ev.url) : null

        if (percorsiIncompleti && pagina?.testo) {
          await new Promise((r) => setTimeout(r, 1500))
          const percorsiArricchiti = await arricchisciPercorsi(ev, pagina.testo, googleKey)
          if (percorsiArricchiti.length > 0) ev.percorsi = percorsiArricchiti
        }

        const { data: esistente } = await supabase
          .from('eventi_ricercati').select('id, immagine_url').ilike('nome', ev.nome.trim()).maybeSingle()

        if (!esistente) {
          await supabase.from('eventi_ricercati').insert({
            nome: ev.nome.trim(),
            data: ev.data ?? null,
            data_fine: ev.data_fine ?? null,
            luogo: ev.luogo ?? null,
            tipologia: ev.tipologia ?? null,
            url: ev.url ?? fonte.url,
            percorsi: ev.percorsi ?? [],
            immagine_url: immagineUrl,
            attivo: true,
          })
          nuoviFonte++
        } else {
          const aggiornamenti: Record<string, unknown> = {}
          if (immagineUrl && !esistente.immagine_url) aggiornamenti.immagine_url = immagineUrl
          if (percorsiIncompleti && ev.percorsi?.length) aggiornamenti.percorsi = ev.percorsi
          if (Object.keys(aggiornamenti).length) {
            await supabase.from('eventi_ricercati').update(aggiornamenti).eq('id', esistente.id)
          }
        }
      }

      logFonte.push(`✅ ${fonte.nome}: ${eventi.length} eventi trovati, ${nuoviFonte} nuovi`)
    } catch (e) {
      logFonte.push(`❌ ${fonte.nome}: errore - ${e}`)
    }
    return { log: logFonte, nuovi: nuoviFonte }
  }))

  const log = risultatiPerFonte.flatMap((r) => r.log)
  const nuovi = risultatiPerFonte.reduce((acc, r) => acc + r.nuovi, 0)

  return Response.json({
    messaggio: `Scoperta completata: ${nuovi} nuovi eventi aggiunti`,
    log,
  })
}

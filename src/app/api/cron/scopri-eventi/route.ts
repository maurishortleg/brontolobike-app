import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANNO = new Date().getFullYear()

const TIPOLOGIE = [
  'Bike Camp Livigno', 'Brevetto Permanente Gravel', 'Brevetto Permanente Strada',
  'Brontolo Bike Day', 'Ciclocross', 'Gara in Circuito (CRIT)', 'Gran/Medio Fondo',
  'Gravel', 'Gravel di GRAvellAND', 'MTB', 'Pedalata Cicloturistica',
  'Percorso con Credenziale', 'Randonnée fino a 120Km', 'Randonnée oltre i 120Km',
  'Trail', 'Uva Fragola',
]

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
    // Rimuove script/style, poi strip tag HTML
    const testo = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 12000) // max 12k caratteri per non saturare il contesto Gemini
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

function correggiRandonnee(tipologia: string | null, km: number | null): string | null {
  if (!tipologia?.toLowerCase().includes('randonn')) return tipologia
  if (km == null) return tipologia
  return km <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
}

type Percorso = { nome: string; km: number | null; dislivello: number | null; tipologia: string | null }

async function arricchisciPercorsi(
  ev: { nome: string; tipologia: string | null; percorsi: Percorso[] },
  testoPageina: string,
  tipologieStr: string,
  googleKey: string,
): Promise<Percorso[]> {
  const prompt = `Dal testo della pagina web dell'evento ciclistico "${ev.nome}", estrai TUTTI i percorsi disponibili.

Per ogni percorso crea un oggetto con:
- nome: nome ufficiale del percorso
- km: distanza in km (numero intero), null se non trovata
- dislivello: dislivello in metri (numero intero), null se non trovato
- tipologia: scegli da: ${tipologieStr} — oppure null

Regole:
- Cerca tutte le distanze (es. SHORT 200, CLASSIC 300, WILD 400, ecc.)
- I km e il dislivello possono essere scritti come "300 km / 4600 D+" o simili
- Restituisci SOLO un array JSON valido senza markdown

TESTO PAGINA:
${testoPageina}`

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal: AbortSignal.timeout(20000),
      }
    )
    if (!res.ok) return ev.percorsi
    const data = await res.json()
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed : ev.percorsi
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

  const tipologieStr = TIPOLOGIE.map((t) => `"${t}"`).join(', ')

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

  // ?fonte=N processa solo quella fonte (per trigger manuale su piano Hobby)
  const fonteParam = req.nextUrl.searchParams.get('fonte')
  const fontiDaProcessare = fonteParam !== null
    ? [FONTI[parseInt(fonteParam)]].filter(Boolean)
    : FONTI

  // Processa le fonti in parallelo
  const risultatiPerFonte = await Promise.all(fontiDaProcessare.map(async (fonte) => {
    const logFonte: string[] = []
    let nuoviFonte = 0
    try {
      // Cerca eventi sul sito tramite Tavily
      // Esegue le query in sequenza, si ferma alla prima che restituisce risultati
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
        // Aggiunge risultati non duplicati per URL
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

      const REGIONI = 'Val d\'Aosta, Piemonte, Liguria, Lombardia, Veneto, Trentino Alto Adige, Friuli Venezia Giulia, Emilia Romagna, Toscana, Marche, Umbria, Abruzzo, Molise, Lazio'

      const prompt = `Dai seguenti risultati del sito "${fonte.nome}" (${fonte.url}), estrai gli eventi ciclistici del ${ANNO} che si svolgono nelle seguenti regioni italiane: ${REGIONI}.

Per ogni evento crea un oggetto con:
- nome: nome completo e ufficiale dell'evento
- data: data inizio YYYY-MM-DD, null se non trovata
- data_fine: data fine YYYY-MM-DD per eventi multi-giorno, null altrimenti
- luogo: città o paese di partenza, null se non trovato
- tipologia: scegli da: ${tipologieStr} — oppure null
- url: URL diretto alla pagina specifica dell'evento (non homepage né calendario generale)
- percorsi: array con TUTTI i percorsi disponibili dell'evento, ognuno con:
    { nome (nome ufficiale del percorso), km (numero intero), dislivello (numero intero o null), tipologia (dalla lista o null) }

Regole IMPORTANTI:
- Includi SOLO eventi nelle regioni elencate: ${REGIONI}. Escludi tutto il Sud Italia (Campania, Puglia, Basilicata, Calabria, Sicilia, Sardegna)
- Includi solo eventi del ${ANNO} o futuri (escludi eventi già passati)
- Cerca TUTTI i percorsi: spesso un evento ha 3-5 distanze diverse (es. 60km, 80km, 110km, 160km) — includile tutte
- I km e il dislivello possono essere nel testo, nelle tabelle o nelle descrizioni dei percorsi
- Se lo stesso evento appare più volte, tienilo una volta sola con tutti i percorsi trovati
- Per GravelLand usa sempre tipologia "Gravel di GRAvellAND"
- Per Randonnée/Audax: OGNI percorso DEVE avere tipologia "Randonnée fino a 120Km" se km ≤ 120, altrimenti "Randonnée oltre i 120Km"

Restituisci SOLO un array JSON valido senza markdown. Se non trovi eventi nelle regioni indicate restituisci [].

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
        logFonte.push(`⚠️ ${fonte.nome}: errore Gemini ${geminiRes.status}`)
        return { log: logFonte, nuovi: nuoviFonte }
      }

      const geminiData = await geminiRes.json()
      const text: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? ''
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()

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

      await Promise.all(eventi.map(async (ev) => {
        if (!ev.nome?.trim()) return

        const dominio = dominioUrl(ev.url ?? '')
        if (dominio === 'gravelland.it') {
          ev.tipologia = 'Gravel di GRAvellAND'
          ev.percorsi = ev.percorsi?.map((p) => ({ ...p, tipologia: 'Gravel di GRAvellAND' })) ?? []
        } else {
          const kmMax = ev.percorsi?.length > 0 ? Math.max(...ev.percorsi.map((p) => p.km ?? 0)) : null
          // Determina se è un evento Randonnée (da tipologia, nome evento o fonte Audax)
          const isRandonnee =
            ev.tipologia?.toLowerCase().includes('randonn') ||
            ev.nome?.toLowerCase().includes('randonn') ||
            fonte.nome.toLowerCase().includes('audax') ||
            fonte.dominio.includes('audaxitalia')
          if (isRandonnee && kmMax != null) {
            ev.tipologia = kmMax <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
          } else {
            ev.tipologia = correggiRandonnee(ev.tipologia, kmMax) ?? ev.tipologia
          }
          // Per ogni percorso: se Randonnée assegna la categoria in base ai km specifici del percorso
          ev.percorsi = ev.percorsi?.map((p) => {
            if (p.km != null && (isRandonnee || p.tipologia?.toLowerCase().includes('randonn'))) {
              return { ...p, tipologia: p.km <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km' }
            }
            return { ...p, tipologia: correggiRandonnee(p.tipologia ?? ev.tipologia, p.km) ?? p.tipologia }
          }) ?? []
        }

        // Fetch pagina evento: serve sia per og:image sia per arricchire percorsi mancanti
        const percorsiIncompleti = !ev.percorsi?.length || ev.percorsi.some((p) => p.km == null)
        const pagina = ev.url ? await fetchPagina(ev.url) : null
        const immagineUrl = pagina ? estraiOgImage(pagina.html, ev.url) : null

        if (percorsiIncompleti && pagina?.testo) {
          const percorsiArricchiti = await arricchisciPercorsi(ev, pagina.testo, tipologieStr, googleKey)
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
          // Aggiorna immagine e/o percorsi sull'evento esistente se mancanti
          const aggiornamenti: Record<string, unknown> = {}
          if (immagineUrl && !esistente.immagine_url) aggiornamenti.immagine_url = immagineUrl
          if (percorsiIncompleti && ev.percorsi?.length) aggiornamenti.percorsi = ev.percorsi
          if (Object.keys(aggiornamenti).length) {
            await supabase.from('eventi_ricercati').update(aggiornamenti).eq('id', esistente.id)
          }
        }
      }))

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

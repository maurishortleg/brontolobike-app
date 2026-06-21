import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ANNO = new Date().getFullYear()

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

      const prompt = `Dai seguenti risultati del sito "${fonte.nome}" (${fonte.url}), estrai tutti gli eventi ciclistici del ${ANNO} che si svolgono in ITALIA.

Per ogni evento crea un oggetto con:
- nome: nome completo e ufficiale dell'evento
- data: data inizio YYYY-MM-DD, null se non trovata
- data_fine: data fine YYYY-MM-DD per eventi multi-giorno, null altrimenti
- luogo: città o paese di partenza in Italia, null se non trovato
- tipologia: scegli da: ${tipologieStr} — oppure null
- url: URL diretto alla pagina specifica dell'evento (non homepage né calendario generale)
- percorsi: array con TUTTI i percorsi disponibili dell'evento, ognuno con:
    { nome (nome ufficiale del percorso), km (numero intero), dislivello (numero intero o null), tipologia (dalla lista o null) }

Regole IMPORTANTI:
- Includi SOLO eventi in Italia del ${ANNO} o futuri (escludi eventi già passati o all'estero)
- Cerca TUTTI i percorsi: spesso un evento ha 3-5 distanze diverse (es. 60km, 80km, 110km, 160km) — includile tutte
- I km e il dislivello possono essere nel testo, nelle tabelle o nelle descrizioni dei percorsi
- Se lo stesso evento appare più volte, tienilo una volta sola con tutti i percorsi trovati
- Per GravelLand usa sempre tipologia "Gravel di GRAvelAND"
- Per Audax/brevetti usa "Randonnée fino a 120Km" o "Randonnée oltre i 120Km" in base ai km del percorso

Restituisci SOLO un array JSON valido senza markdown. Se non trovi eventi italiani restituisci [].

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
        percorsi: { nome: string; km: number; dislivello: number | null; tipologia: string | null }[]
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
          ev.tipologia = 'Gravel di GRAvelAND'
          ev.percorsi = ev.percorsi?.map((p) => ({ ...p, tipologia: 'Gravel di GRAvelAND' })) ?? []
        } else {
          const kmMax = ev.percorsi?.length > 0 ? Math.max(...ev.percorsi.map((p) => p.km ?? 0)) : null
          ev.tipologia = correggiRandonnee(ev.tipologia, kmMax) ?? ev.tipologia
          ev.percorsi = ev.percorsi?.map((p) => ({
            ...p,
            tipologia: correggiRandonnee(p.tipologia ?? ev.tipologia, p.km) ?? p.tipologia,
          })) ?? []
        }

        const { data: esistente } = await supabase
          .from('eventi_ricercati').select('id').ilike('nome', ev.nome.trim()).maybeSingle()

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
          nuoviFonte++
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

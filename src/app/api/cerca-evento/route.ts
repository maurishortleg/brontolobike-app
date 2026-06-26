import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { tavilySearch, fetchImmaginiMappa } from '@/lib/tavily'

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
  'Gravel di GRAvellAND',
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
  data_fine: string | null
  luogo: string | null
  tipologia: string | null
  url: string
  percorsi: PercorsoTrovato[]
}

function dominioUrl(url: string): string {
  try { return new URL(url).hostname.replace('www.', '') } catch { return '' }
}

function correggiRandonnee(tipologia: string | null, km: number | null): string | null {
  if (!tipologia) return tipologia
  const isRandonnee = tipologia.toLowerCase().includes('randonn')
  if (!isRandonnee) return tipologia
  if (km == null) return tipologia
  return km <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
}

export async function POST(req: NextRequest) {
  const { query } = await req.json()

  if (!query?.trim()) {
    return Response.json({ error: 'Query mancante' }, { status: 400 })
  }

  const anno = new Date().getFullYear()
  const tavilyKey = process.env.TAVILY_API_KEY
  if (!tavilyKey) {
    return Response.json({ error: 'Chiave API di ricerca non configurata' }, { status: 500 })
  }

  const { results, images } = await tavilySearch(
    tavilyKey,
    `${query} ciclismo ${anno} percorsi km dislivello`,
    3,
    8,
  )

  if (results.length === 0) {
    return Response.json({ risultati: [] })
  }

  const googleKey = process.env.GOOGLE_AI_API_KEY
  if (!googleKey) {
    return Response.json({ risultati: [] })
  }

  // Scarica immagini mappa/tracciato per arricchire l'estrazione
  const immagini = await fetchImmaginiMappa(images, 3)

  const textResults = results
    .map((r) => `TITOLO: ${r.title}\nURL: ${r.url}\nCONTENUTO: ${r.content}`)
    .join('\n\n---\n\n')

  const tipologieStr = TIPOLOGIE.map((t) => `"${t}"`).join(', ')

  const prompt = `Dai seguenti risultati di ricerca su eventi ciclistici del ${anno}, estrai una lista di eventi in formato JSON.

Per ogni evento trovato, crea un oggetto con:
- nome: nome completo dell'evento (stringa)
- data: data di inizio in formato YYYY-MM-DD se trovata, altrimenti null. Considera solo date del ${anno}.
- data_fine: data di fine in formato YYYY-MM-DD per eventi multi-giorno (es. Randonnée, Trail, stage race), altrimenti null
- luogo: città o paese di partenza/svolgimento dell'evento (es. "Varese", "Pinarello di Noale"), null se non trovato
- tipologia: tipologia prevalente dell'evento, scelta da questa lista: ${tipologieStr} — oppure null
- url: URL del sito più autorevole (preferisci il sito ufficiale dell'evento, poi siti specializzati)
- percorsi: array con TUTTI i percorsi disponibili per quell'evento. Ogni percorso ha:
  - nome: nome ESATTO del percorso come riportato dall'evento — NON usare nomi generici come "Lungo", "Medio", "Corto" a meno che non siano i nomi ufficiali
  - km: chilometri come numero intero
  - dislivello: dislivello in metri come numero intero, null se non trovato
  - tipologia: tipologia specifica di questo percorso, scelta dalla stessa lista — oppure null

Regole:
- Dai priorità agli eventi del ${anno}. Se non trovi dati completi per il ${anno}, usa i dati dell'edizione più recente disponibile come riferimento per i percorsi (km e dislivello cambiano raramente)
- Se lo stesso evento appare su più siti, tienilo una volta sola con l'URL più autorevole
- Cerca TUTTI i percorsi disponibili nei risultati, anche se sono menzionati in modo sparso nel testo
- Se trovi km e dislivello anche senza un nome percorso esplicito, includili con nome "Percorso [km] km"

Restituisci SOLO un array JSON valido, senza markdown. Massimo 4 eventi distinti. Se non trovi nulla di rilevante, restituisci [].

RISULTATI:
${textResults}`

  // Costruisce i parts: testo + eventuali immagini mappa
  const parts: object[] = [{ text: prompt }]
  for (const img of immagini) {
    parts.push({ inline_data: { mime_type: img.mimeType, data: img.data } })
  }
  if (immagini.length > 0) {
    parts.push({ text: 'Le immagini sopra potrebbero contenere mappe o altimetrie del tracciato. Estrai da esse km e dislivello se presenti.' })
  }

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${googleKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
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

    // Correggi tipologie per regole speciali
    parsed = parsed.map((ev) => {
      const dominio = dominioUrl(ev.url)

      // Regola GRAvellAND
      if (dominio === 'gravelland.it') {
        return {
          ...ev,
          tipologia: 'Gravel di GRAvellAND',
          percorsi: ev.percorsi.map((p) => ({
            ...p,
            tipologia: p.tipologia === 'Gravel' ? 'Gravel di GRAvellAND' : (p.tipologia ?? 'Gravel di GRAvellAND'),
          })),
        }
      }

      // Regola Randonnée: assegna la categoria per ogni percorso in base ai suoi km specifici
      const isRandonnee =
        ev.tipologia?.toLowerCase().includes('randonn') ||
        ev.nome?.toLowerCase().includes('randonn') ||
        ev.url?.toLowerCase().includes('audax')

      const percorsiCorrotti = ev.percorsi.map((p) => {
        if (p.km != null && (isRandonnee || p.tipologia?.toLowerCase().includes('randonn'))) {
          return { ...p, tipologia: p.km <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km' }
        }
        return { ...p, tipologia: correggiRandonnee(p.tipologia ?? ev.tipologia, p.km) }
      })

      // Tipologia evento = quella del percorso più lungo
      const kmMax = percorsiCorrotti.length > 0
        ? Math.max(...percorsiCorrotti.map((p) => p.km ?? 0))
        : null
      const tipologiaEvento = isRandonnee && kmMax != null
        ? (kmMax <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km')
        : (correggiRandonnee(ev.tipologia, kmMax) ?? ev.tipologia)

      return { ...ev, tipologia: tipologiaEvento, percorsi: percorsiCorrotti }
    })

    risultati = parsed
  } catch {
    return Response.json({ risultati: [] })
  }

  // Salva nel database per autocomplete futuro
  if (risultati.length > 0) {
    try {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      for (const ev of risultati) {
        const { data: esistente } = await supabase
          .from('eventi_ricercati')
          .select('id')
          .ilike('nome', ev.nome)
          .maybeSingle()
        if (!esistente) {
          await supabase.from('eventi_ricercati').insert({
            nome: ev.nome,
            data: ev.data,
            data_fine: ev.data_fine ?? null,
            luogo: ev.luogo,
            tipologia: ev.tipologia,
            url: ev.url,
            percorsi: ev.percorsi,
          })
        } else {
          // Aggiorna ma preserva i percorsi esistenti se il nuovo risultato non ne ha
          const { data: vecchio } = await supabase
            .from('eventi_ricercati')
            .select('percorsi')
            .eq('id', esistente.id)
            .single()
          await supabase.from('eventi_ricercati').update({
            data: ev.data,
            data_fine: ev.data_fine ?? null,
            luogo: ev.luogo,
            tipologia: ev.tipologia,
            url: ev.url,
            percorsi: (ev.percorsi?.length > 0) ? ev.percorsi : (vecchio?.percorsi ?? []),
            ultimo_controllo: new Date().toISOString(),
          }).eq('id', esistente.id)
        }
      }
    } catch (e) {
      console.error('Errore salvataggio DB eventi:', e)
    }
  }

  return Response.json({ risultati })
}

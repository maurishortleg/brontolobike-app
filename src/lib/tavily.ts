const SITI_PRIORITARI = [
  'gravelland.it',
  'battistrada.com',
  'audaxitalia.it',
  'granfondo.it',
  'endu.net',
]

// Pattern URL per immagini che probabilmente contengono mappe/tracciati con km e dislivello
const IMAGE_MAP_PATTERNS = [
  /map/i, /tracciato/i, /percorso/i, /route/i, /altimetri/i, /profil/i,
  /strava/i, /gpx/i, /mappa/i, /elevation/i, /dislivello/i, /km/i,
]

export type TavilyResult = {
  title: string
  url: string
  content: string
}

type TavilyImage = {
  url: string
  description?: string
}

/**
 * Ricerca Tavily in due fasi:
 * 1. Prima sui siti prioritari (i 5 siti del club)
 * 2. Se < minResults, espande a tutti i siti ciclistici
 */
export async function tavilySearch(
  apiKey: string,
  query: string,
  minResults = 3,
  maxResults = 8,
): Promise<{ results: TavilyResult[]; images: TavilyImage[] }> {
  // Fase 1: solo siti prioritari
  const res1 = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: 'advanced',
      max_results: maxResults,
      include_answer: false,
      include_images: true,
      include_domains: SITI_PRIORITARI,
    }),
  })

  let results: TavilyResult[] = []
  let images: TavilyImage[] = []

  if (res1.ok) {
    const d = await res1.json()
    results = d.results ?? []
    images = d.images ?? []
  }

  // Fase 2: se risultati insufficienti, espande a tutti i siti ciclistici
  if (results.length < minResults) {
    const res2 = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'advanced',
        max_results: maxResults,
        include_answer: false,
        include_images: true,
      }),
    })

    if (res2.ok) {
      const d = await res2.json()
      // Aggiunge risultati non duplicati
      const urlsEsistenti = new Set(results.map((r) => r.url))
      const nuovi: TavilyResult[] = (d.results ?? []).filter((r: TavilyResult) => !urlsEsistenti.has(r.url))
      results = [...results, ...nuovi].slice(0, maxResults)
      // Aggiunge immagini non duplicate
      const imgEsistenti = new Set(images.map((i) => i.url))
      const nuoveImg: TavilyImage[] = (d.images ?? []).filter((i: TavilyImage) => !imgEsistenti.has(i.url))
      images = [...images, ...nuoveImg]
    }
  }

  return { results, images }
}

/**
 * Scarica immagini che sembrano mappe/tracciati e le converte in base64
 * per passarle a Gemini Vision. Massimo maxImages immagini.
 */
export async function fetchImmaginiMappa(
  images: TavilyImage[],
  maxImages = 3,
): Promise<{ mimeType: string; data: string }[]> {
  // Filtra le immagini che probabilmente sono mappe o tracciati
  const candidate = images
    .filter((img) => IMAGE_MAP_PATTERNS.some((p) => p.test(img.url) || p.test(img.description ?? '')))
    .slice(0, maxImages)

  // Se non ci sono candidati con pattern, prende le prime N immagini generiche
  const toFetch = candidate.length > 0 ? candidate : images.slice(0, maxImages)

  const risultati: { mimeType: string; data: string }[] = []

  await Promise.all(
    toFetch.map(async (img) => {
      try {
        const res = await fetch(img.url, {
          signal: AbortSignal.timeout(5000),
          headers: { 'User-Agent': 'Mozilla/5.0' },
        })
        if (!res.ok) return

        const contentType = res.headers.get('content-type') ?? 'image/jpeg'
        const mimeType = contentType.split(';')[0].trim()
        if (!mimeType.startsWith('image/')) return

        const buffer = await res.arrayBuffer()
        // Limite 4MB per immagine
        if (buffer.byteLength > 4 * 1024 * 1024) return

        const data = Buffer.from(buffer).toString('base64')
        risultati.push({ mimeType, data })
      } catch {
        // ignora errori di download singola immagine
      }
    }),
  )

  return risultati
}

import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) {
    return Response.json({ risultati: [] })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase
    .from('eventi')
    .select('id, nome, data_evento, data_fine, tipologia, luogo, url, immagine_url, attivo')
    .ilike('nome', `%${q}%`)
    .eq('attivo', true)
    .order('created_at', { ascending: false })
    .limit(6)

  if (error) {
    return Response.json({ risultati: [] })
  }

  // Compatibilità con i componenti che leggono ev.data e ev.percorsi
  const risultati = (data ?? []).map((ev) => ({
    ...ev,
    data: ev.data_evento,
    percorsi: [],
  }))

  return Response.json({ risultati })
}

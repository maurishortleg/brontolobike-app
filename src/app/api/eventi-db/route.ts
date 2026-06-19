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
    .from('eventi_ricercati')
    .select('*')
    .ilike('nome', `%${q}%`)
    .order('creato_il', { ascending: false })
    .limit(6)

  if (error) {
    return Response.json({ risultati: [] })
  }

  return Response.json({ risultati: data ?? [] })
}

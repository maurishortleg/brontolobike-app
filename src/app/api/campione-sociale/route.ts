import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { ultimaDomenicaOttobre } from '@/lib/date-utils'

// GET /api/campione-sociale?anno=2027
// Restituisce il campione solo se oggi è dopo l'ultima domenica di ottobre dell'anno richiesto
export async function GET(req: NextRequest) {
  const annoParam = req.nextUrl.searchParams.get('anno')
  const supabase = await createSupabaseServerClient()

  const { data: stagioni } = await supabase
    .from('stagioni')
    .select('id, anno, attiva')
    .order('anno', { ascending: false })

  const stagioneSelezionata = annoParam
    ? stagioni?.find((s) => String(s.anno) === annoParam)
    : stagioni?.find((s) => s.attiva) ?? stagioni?.[0]

  const anno = stagioneSelezionata?.anno ?? 2027
  const stagioneId = stagioneSelezionata?.id ?? null
  const scadenza = ultimaDomenicaOttobre(anno)
  const scadenzaStr = scadenza.toISOString().split('T')[0]
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)

  // Il campione si rivela solo dopo la scadenza
  const scadenzaPassata = oggi > scadenza

  if (!scadenzaPassata) {
    return Response.json({ campione: null, scadenza: scadenzaStr, anno })
  }

  const { data: atleti } = await supabase
    .from('atleti')
    .select(`
      id,
      nome_cognome,
      categoria_corrente,
      registrazioni (
        punti,
        stagione_id
      )
    `)

  if (!atleti) return Response.json({ campione: null, scadenza: scadenzaStr, anno })

  let campione: { id: string; nome: string; categoria: string; punti: number } | null = null

  for (const a of atleti) {
    let punti = 0
    for (const r of a.registrazioni ?? []) {
      if (stagioneId && (r as any).stagione_id === stagioneId) {
        punti += r.punti ?? 0
      }
    }
    if (punti > 0 && (!campione || punti > campione.punti)) {
      campione = { id: a.id, nome: a.nome_cognome, categoria: a.categoria_corrente, punti }
    }
  }

  return Response.json({ campione, scadenza: scadenzaStr, anno })
}

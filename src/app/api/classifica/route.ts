import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { ultimaDomenicaOttobre } from '@/lib/date-utils'

// GET /api/classifica?categoria=AMATORI|CICLOTURISTI&anno=2027
export async function GET(req: NextRequest) {
  const categoria = req.nextUrl.searchParams.get('categoria') ?? 'AMATORI'
  const annoParam = req.nextUrl.searchParams.get('anno')
  const supabase = await createSupabaseServerClient()

  // Recupera tutte le stagioni
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

  const { data: atleti } = await supabase
    .from('atleti')
    .select(`
      id,
      nome_cognome,
      registrazioni (
        punti,
        stagione_id
      )
    `)
    .eq('categoria_corrente', categoria)
    .eq('attivo', true)
    .order('nome_cognome')

  if (!atleti) return Response.json({ classifica: [], anno, stagioni: stagioni ?? [] })

  const sogliaFinisher = categoria === 'AMATORI' ? 9000 : 4000

  const classifica = atleti.map((a) => {
    let puntiTotali = 0
    for (const r of a.registrazioni ?? []) {
      if (stagioneId && (r as any).stagione_id === stagioneId) {
        puntiTotali += r.punti ?? 0
      }
    }
    return {
      id: a.id,
      nome: a.nome_cognome,
      punti: puntiTotali,
      finisher: puntiTotali >= sogliaFinisher,
    }
  })

  classifica.sort((a, b) => b.punti - a.punti)

  return Response.json({
    classifica,
    scadenza: scadenzaStr,
    anno,
    stagioni: (stagioni ?? []).map((s) => ({ anno: s.anno, attiva: s.attiva })),
  })
}

import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

function ultimaDomenicaOttobre(anno: number): Date {
  const d = new Date(anno, 9, 31)
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1)
  return d
}

// GET /api/classifica?categoria=AMATORI|CICLOTURISTI
export async function GET(req: NextRequest) {
  const categoria = req.nextUrl.searchParams.get('categoria') ?? 'AMATORI'
  const supabase = await createSupabaseServerClient()

  const anno = new Date().getFullYear()
  const inizioAnno = `${anno}-01-01`
  const scadenza = ultimaDomenicaOttobre(anno)
  const scadenzaStr = scadenza.toISOString().split('T')[0]

  const { data: atleti } = await supabase
    .from('atleti')
    .select(`
      id,
      nome_cognome,
      registrazioni (
        punti,
        percorsi (
          eventi (
            data_evento
          )
        )
      )
    `)
    .eq('categoria_corrente', categoria)
    .eq('attivo', true)
    .order('nome_cognome')

  if (!atleti) return Response.json({ classifica: [] })

  const sogliaFinisher = categoria === 'AMATORI' ? 9000 : 4000

  const classifica = atleti.map((a) => {
    let puntiTotali = 0
    for (const r of a.registrazioni ?? []) {
      const dataEvento = (r.percorsi as any)?.eventi?.data_evento
      if (dataEvento && dataEvento >= inizioAnno) {
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

  return Response.json({ classifica, scadenza: scadenzaStr })
}

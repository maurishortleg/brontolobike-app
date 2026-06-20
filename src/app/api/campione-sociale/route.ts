import { createSupabaseServerClient } from '@/lib/supabase-server'

function ultimaDomenicaOttobre(anno: number): Date {
  const d = new Date(anno, 9, 31)
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1)
  return d
}

// GET /api/campione-sociale
// Restituisce l'atleta con più punti accumulati entro l'ultima domenica di ottobre
export async function GET() {
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
      categoria_corrente,
      registrazioni (
        punti,
        percorsi (
          eventi (
            data_evento
          )
        )
      )
    `)

  if (!atleti) return Response.json({ campione: null })

  let campione: { id: string; nome: string; categoria: string; punti: number } | null = null

  for (const a of atleti) {
    let puntiEntroScadenza = 0
    for (const r of a.registrazioni ?? []) {
      const dataEvento = (r.percorsi as any)?.eventi?.data_evento
      if (!dataEvento) continue
      if (dataEvento >= inizioAnno && dataEvento <= scadenzaStr) {
        puntiEntroScadenza += r.punti ?? 0
      }
    }
    if (!campione || puntiEntroScadenza > campione.punti) {
      campione = { id: a.id, nome: a.nome_cognome, categoria: a.categoria_corrente, punti: puntiEntroScadenza }
    }
  }

  return Response.json({ campione, scadenza: scadenzaStr })
}

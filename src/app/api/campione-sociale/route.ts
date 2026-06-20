import { createSupabaseServerClient } from '@/lib/supabase-server'

function ultimaDomenicaOttobre(anno: number): Date {
  const d = new Date(anno, 9, 31)
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1)
  return d
}

// GET /api/campione-sociale
// Restituisce il campione solo se oggi è dopo l'ultima domenica di ottobre
// e qualcuno ha punti > 0 entro quella data
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const anno = new Date().getFullYear()
  const inizioAnno = `${anno}-01-01`
  const scadenza = ultimaDomenicaOttobre(anno)
  const scadenzaStr = scadenza.toISOString().split('T')[0]
  const oggi = new Date()
  oggi.setHours(0, 0, 0, 0)

  // Il campione si rivela solo dopo la scadenza
  const scadenzaPassata = oggi > scadenza

  if (!scadenzaPassata) {
    return Response.json({ campione: null, scadenza: scadenzaStr })
  }

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

  if (!atleti) return Response.json({ campione: null, scadenza: scadenzaStr })

  let campione: { id: string; nome: string; categoria: string; punti: number } | null = null

  for (const a of atleti) {
    let punti = 0
    for (const r of a.registrazioni ?? []) {
      const dataEvento = (r.percorsi as any)?.eventi?.data_evento
      if (dataEvento && dataEvento >= inizioAnno && dataEvento <= scadenzaStr) {
        punti += r.punti ?? 0
      }
    }
    if (punti > 0 && (!campione || punti > campione.punti)) {
      campione = { id: a.id, nome: a.nome_cognome, categoria: a.categoria_corrente, punti }
    }
  }

  return Response.json({ campione, scadenza: scadenzaStr })
}

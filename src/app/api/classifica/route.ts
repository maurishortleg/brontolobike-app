import { NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// Ultima domenica di ottobre dell'anno corrente
function ultimaDomenicaOttobre(anno: number): Date {
  // Partiamo dal 31 ottobre e torniamo indietro fino a domenica
  const d = new Date(anno, 9, 31) // ottobre = mese 9
  while (d.getDay() !== 0) d.setDate(d.getDate() - 1)
  return d
}

// GET /api/classifica?categoria=Amatori|Cicloturisti
export async function GET(req: NextRequest) {
  const categoria = req.nextUrl.searchParams.get('categoria') ?? 'Amatori'
  const supabase = await createSupabaseServerClient()

  const anno = new Date().getFullYear()
  const inizioAnno = `${anno}-01-01`
  const scadenzaCampione = ultimaDomenicaOttobre(anno)
  const oggi = new Date()
  const campioneSocialeDefinito = oggi > scadenzaCampione

  // Recupera atleti della categoria con le loro registrazioni dell'anno corrente
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
    .eq('categoria_corrente', categoria)
    .order('nome_cognome')

  if (!atleti) return Response.json({ classifica: [], campione: null })

  // Calcola punti totali dell'anno per ogni atleta
  const classifica = atleti.map((a) => {
    let puntiTotali = 0
    let puntiEntroScadenza = 0

    for (const r of a.registrazioni ?? []) {
      const dataEvento = (r.percorsi as any)?.eventi?.data_evento
      if (!dataEvento) continue
      const data = new Date(dataEvento)
      if (data >= new Date(inizioAnno)) {
        puntiTotali += r.punti ?? 0
        if (data <= scadenzaCampione) {
          puntiEntroScadenza += r.punti ?? 0
        }
      }
    }

    const sogliaFinisher = categoria === 'Amatori' ? 9000 : 4000
    return {
      id: a.id,
      nome: a.nome_cognome,
      punti: puntiTotali,
      puntiEntroScadenza,
      finisher: puntiTotali >= sogliaFinisher,
    }
  })

  classifica.sort((a, b) => b.punti - a.punti)

  // Campione Sociale: chi ha più puntiEntroScadenza tra tutte le categorie
  // Viene calcolato separatamente nell'API /api/campione-sociale
  // Qui torniamo solo la classifica di categoria

  return Response.json({ classifica, campioneSocialeDefinito, scadenzaCampione: scadenzaCampione.toISOString().split('T')[0] })
}

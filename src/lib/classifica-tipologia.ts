/**
 * classifica-tipologia.ts
 * Libreria condivisa per la classificazione delle tipologie evento.
 * Usata da scopri-eventi, aggiorna-eventi e dal fix retroattivo.
 */

export const TIPOLOGIE = [
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

/**
 * Descrizioni dettagliate da includere nel prompt Gemini.
 * Ogni descrizione ha: definizione, parole chiave, esempi, e cosa NON è.
 */
export const TIPOLOGIE_DESCRIZIONI = `
Scegli la tipologia dalla lista seguente. Per ogni tipo trovi: descrizione, parole chiave, e cosa NON è.

1. "Gran/Medio Fondo" — Gara ciclistica su strada (anche amatoriale/granfondistica), percorso 60–300 km con chip/timing. Keyword: granfondo, gran fondo, medio fondo, GF, sportful, marathon. NON è: pedalata turistica, evento non cronometrato.

2. "Pedalata Cicloturistica" — Uscita NON competitiva, aperta a tutti, senza classifica. Keyword: pedalata, cicloturistica, passeggiata, giro, ciclopasseggiata, cicloescursione. NON è: una gara, anche se c'è un percorso definito.

3. "Gravel" — Evento su sterrato/ghiaia con bici gravel/ciclocross. NON è: MTB (troppo tecnico), Trail (sentieri alpini), Gran Fondo (solo asfalto).

4. "Gravel di GRAvellAND" — Evento ESCLUSIVAMENTE organizzato da GravelLand (gravelland.it). Keyword: gravelland. Se il sito è gravelland.it → usa SEMPRE questo tipo.

5. "Trail" — Percorso off-road su sentieri naturali/boschivi, tipicamente in montagna. Keyword: bike trail, trail ride, sentiero. NON è Gravel (che è su strade bianche/ghiaia).

6. "MTB" — Mountain bike, fuoristrada tecnico, spesso competitivo. Keyword: mtb, mountain bike, enduro, downhill, cross country, XC. NON è Gravel o Trail.

7. "Randonnée fino a 120Km" — Brevetto ciclistico ACP/Audax, distanza ≤ 120 km. NON è competitivo, basato sul completamento entro il tempo limite. Keyword: randonnée, randonn, audax, BRM, brevet.

8. "Randonnée oltre i 120Km" — Brevetto ciclistico ACP/Audax, distanza > 120 km (200, 300, 400, 600 km...). Stesse caratteristiche della precedente.

9. "Ciclocross" — Gara su circuito misto sterrato/asfalto, tipicamente autunno-inverno, con bici ciclocross. Keyword: ciclocross, cyclocross, CX.

10. "Gara in Circuito (CRIT)" — Gara ciclistica su circuito chiuso/strade cittadine. Keyword: criterium, crit, circuito chiuso, kermesse.

11. "Brevetto Permanente Gravel" — Brevetto permanente FCI su percorso gravel. NON è una Randonnée (che è ACP/Audax).

12. "Brevetto Permanente Strada" — Brevetto permanente FCI su percorso stradale.

13. "Percorso con Credenziale" — Percorso con timbri/credenziale (tipo Via Francigena, Cammino). Keyword: credenziale, via francigena, cammino.

14. "Brontolo Bike Day" — Evento interno del team BrontoloBike. Keyword: brontolo.

15. "Uva Fragola" — Pedalata tematica uva/fragola. Keyword: uva, fragola.

16. "Bike Camp Livigno" — Campo di allenamento a Livigno. Keyword: bike camp, livigno.

REGOLE CRITICHE:
- Se il nome contiene "Trail" senza "Gravel" → usa "Trail", non "Gravel"
- Se il nome contiene "Gran Fondo" o "Granfondo" → usa "Gran/Medio Fondo", non "Pedalata Cicloturistica"  
- Se il dominio è gravelland.it → usa SEMPRE "Gravel di GRAvellAND"
- Per Randonnée/Audax: la km del percorso determina quale delle due scegliere (≤120 o >120)
- Se non sei sicuro → restituisci null, non inventare
`

/**
 * Classificazione deterministica basata su parole chiave nel nome.
 * Ritorna null se il caso è ambiguo (lascia decidere a Gemini).
 * 
 * @param nome - Nome dell'evento
 * @param dominioUrl - Dominio del sito dell'evento (opzionale)
 * @param kmMax - km massimi dei percorsi (per Randonnée)
 */
export function classificaPerKeyword(
  nome: string,
  dominioUrl?: string | null,
  kmMax?: number | null,
): string | null {
  const n = nome.toLowerCase()
  const d = (dominioUrl ?? '').toLowerCase()

  // Regola 1: GravelLand (dominio prioritario assoluto)
  if (d.includes('gravelland') || n.includes('gravelland')) {
    return 'Gravel di GRAvellAND'
  }

  // Regola 2: Randonnée/Audax (richiede km per disambiguare)
  const isRandonnee =
    n.includes('randonn') || n.includes('audax') || n.includes('brevet')
  if (isRandonnee && kmMax != null) {
    return kmMax <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
  }

  // Regola 3: Gran/Medio Fondo (molto specifico nel nome)
  if (
    n.includes('gran fondo') ||
    n.includes('granfondo') ||
    n.includes('medio fondo') ||
    n.includes('mediofondo')
  ) {
    return 'Gran/Medio Fondo'
  }

  // Regola 4: Ciclocross
  if (n.includes('ciclocross') || n.includes('cyclocross')) {
    return 'Ciclocross'
  }

  // Regola 5: MTB
  if (
    n.includes(' mtb') ||
    n.startsWith('mtb') ||
    n.includes('mountain bike') ||
    n.includes('mountainbike')
  ) {
    return 'MTB'
  }

  // Regola 6: Trail (solo se non c'è "gravel" nel nome)
  if (n.includes('trail') && !n.includes('gravel')) {
    return 'Trail'
  }

  // Regola 7: Pedalata / Cicloturistica (solo se non è una gara)
  if (
    (n.includes('pedalata') || n.includes('cicloturistic')) &&
    !n.includes('gran fondo') &&
    !n.includes('gara')
  ) {
    return 'Pedalata Cicloturistica'
  }

  // Regola 8: Criterium / CRIT
  if (n.includes('criterium') || n.includes('criterum')) {
    return 'Gara in Circuito (CRIT)'
  }

  // Regola 9: Gravel (generico)
  if (n.includes('gravel') && !n.includes('gravelland')) {
    return 'Gravel'
  }

  // Regola 10: Brontolo
  if (n.includes('brontolo')) return 'Brontolo Bike Day'

  // Regola 11: Uva / Fragola
  if (n.includes('uva') || n.includes('fragola')) return 'Uva Fragola'

  // Nessuna regola deterministica → lascia a Gemini
  return null
}

/**
 * Corregge le Randonnée in base ai km (override post-Gemini).
 */
export function correggiRandonnee(
  tipologia: string | null,
  km: number | null,
): string | null {
  if (!tipologia?.toLowerCase().includes('randonn')) return tipologia
  if (km == null) return tipologia
  return km <= 120 ? 'Randonnée fino a 120Km' : 'Randonnée oltre i 120Km'
}

/**
 * Sanity check post-AI: corregge errori evidenti nella tipologia restituita da Gemini
 * confrontandola con il nome dell'evento.
 *
 * @param nome - Nome dell'evento
 * @param tipologiaAI - Tipologia suggerita da Gemini
 * @param dominioUrl - Dominio del sito
 * @param kmMax - km massimi dei percorsi
 */
export function validaTipologia(
  nome: string,
  tipologiaAI: string | null,
  dominioUrl?: string | null,
  kmMax?: number | null,
): string | null {
  if (!tipologiaAI) return tipologiaAI

  const n = nome.toLowerCase()
  const d = (dominioUrl ?? '').toLowerCase()
  const t = tipologiaAI.toLowerCase()

  // GravelLand vince sempre
  if (d.includes('gravelland') || n.includes('gravelland')) {
    return 'Gravel di GRAvellAND'
  }

  // Trail classificato come Gravel o altra cosa
  if (n.includes('trail') && !n.includes('gravel') && !t.includes('trail')) {
    return 'Trail'
  }

  // Gran Fondo classificato come Pedalata o altro
  if (
    (n.includes('gran fondo') || n.includes('granfondo') || n.includes('medio fondo')) &&
    !t.includes('gran')
  ) {
    return 'Gran/Medio Fondo'
  }

  // MTB classificato come altro
  if (
    (n.includes(' mtb') || n.startsWith('mtb') || n.includes('mountain bike')) &&
    !t.includes('mtb')
  ) {
    return 'MTB'
  }

  // Ciclocross classificato come altro
  if ((n.includes('ciclocross') || n.includes('cyclocross')) && !t.includes('ciclocross')) {
    return 'Ciclocross'
  }

  // Randonnée: verifica km
  if (t.includes('randonn') && kmMax != null) {
    return correggiRandonnee(tipologiaAI, kmMax)
  }

  return tipologiaAI
}

/** Stringa tipologie per prompt Gemini (lista semplice) */
export const TIPOLOGIE_STR = TIPOLOGIE.map((t) => `"${t}"`).join(', ')

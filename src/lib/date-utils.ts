/**
 * Calcola l'ultima domenica di ottobre per un dato anno.
 * Utilizzato per determinare la fine del campionato sociale.
 */
export function ultimaDomenicaOttobre(anno: number): Date {
  const d = new Date(anno, 9, 31) // 31 ottobre (mese 9 in JS è ottobre)
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() - 1)
  }
  return d
}

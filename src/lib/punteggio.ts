export type TipologiaEvento = {
  coefficiente_km: number
  punti_fissi: number | null
  ignora_km_dislivello: boolean
}

export function calcolaPunteggio(
  tipologia: TipologiaEvento,
  km: number,
  dislivello: number
): number {
  if (tipologia.ignora_km_dislivello && tipologia.punti_fissi !== null) {
    return tipologia.punti_fissi
  }
  return Math.ceil(km * tipologia.coefficiente_km + dislivello * 0.1)
}

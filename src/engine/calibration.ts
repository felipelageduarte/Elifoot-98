// Constantes que calibram a "sensação" do motor de partida — probabilidades
// e fatores ajustados empiricamente. Expostas em Configurações → Calibração
// para o usuário afinar ao próprio gosto.

export interface Calibration {
  homeDivisor: number // Random(X) < força casa — menor = mais chances em casa
  awayDivisor: number // idem visitante
  neutralDivisor: number // idem em campo neutro (final da taça)
  antiRoutLimit: number // gerador anti-goleada: maior = jogos mais equilibrados
  goalConversionFactor: number // fator base da conversão de finalização em gol
  starBonusPercent: number // bônus do craque `*` na finalização/pênalti
  foulChancePercent: number // chance de falta por minuto, por time
  cardFractionPercent: number // fração das faltas que viram cartão
  redDirectPercent: number // fração dos cartões que são vermelho direto
  penaltyFractionPercent: number // fração das faltas que viram pênalti
  injuryChancePer1000: number // chance de lesão por minuto, por time (a cada 1000)
  maxSubstitutions: number // substituições permitidas por time, por partida
  penaltyConversionFactor: number // conversão de pênaltis em jogo
  shootoutConversionFactor: number // conversão nas cobranças de desempate da taça
}

export const DEFAULT_CALIBRATION: Calibration = {
  homeDivisor: 6000,
  awayDivisor: 7000,
  neutralDivisor: 6500,
  antiRoutLimit: 10,
  goalConversionFactor: 0.42,
  starBonusPercent: 25,
  foulChancePercent: 8,
  cardFractionPercent: 9,
  redDirectPercent: 4,
  penaltyFractionPercent: 2,
  injuryChancePer1000: 3,
  maxSubstitutions: 3,
  penaltyConversionFactor: 0.9,
  shootoutConversionFactor: 0.78,
}

export interface CalibrationField {
  key: keyof Calibration
  label: string
  hint: string
  min: number
  max: number
  step: number
  unit?: string
}

export const CALIBRATION_FIELDS: CalibrationField[] = [
  { key: 'homeDivisor', label: 'Vantagem de mando', hint: 'Menor = mais chances de ataque em casa', min: 3000, max: 9000, step: 100 },
  { key: 'awayDivisor', label: 'Chances do visitante', hint: 'Menor = mais chances de ataque fora de casa', min: 4000, max: 10000, step: 100 },
  { key: 'neutralDivisor', label: 'Chances em campo neutro', hint: 'Usado na final da Taça', min: 3000, max: 9000, step: 100 },
  { key: 'antiRoutLimit', label: 'Anti-goleada', hint: 'Maior = jogos mais equilibrados, menos goleadas', min: 0, max: 30, step: 1 },
  { key: 'goalConversionFactor', label: 'Conversão de gol', hint: 'Maior = mais gols por jogo', min: 0.2, max: 0.7, step: 0.01 },
  { key: 'starBonusPercent', label: 'Bônus do craque ( * )', hint: 'Vantagem extra na finalização e no pênalti', min: 0, max: 60, step: 5, unit: '%' },
  { key: 'foulChancePercent', label: 'Chance de falta', hint: 'Por minuto, por time', min: 0, max: 25, step: 1, unit: '%' },
  { key: 'cardFractionPercent', label: 'Faltas que viram cartão', hint: 'Menor = menos cartões por jogo', min: 0, max: 40, step: 1, unit: '%' },
  { key: 'redDirectPercent', label: 'Vermelho direto', hint: 'Fração dos cartões que são expulsão direta', min: 0, max: 30, step: 1, unit: '%' },
  { key: 'penaltyFractionPercent', label: 'Faltas que viram pênalti', hint: 'Menor = menos pênaltis por jogo', min: 0, max: 15, step: 1, unit: '%' },
  { key: 'injuryChancePer1000', label: 'Chance de lesão', hint: 'Por minuto, por time (a cada mil)', min: 0, max: 15, step: 1 },
  { key: 'maxSubstitutions', label: 'Substituições máximas', hint: 'Por time, por partida', min: 1, max: 6, step: 1 },
  { key: 'penaltyConversionFactor', label: 'Conversão de pênalti', hint: 'Maior = mais pênaltis convertidos em jogo', min: 0.5, max: 1.2, step: 0.01 },
  { key: 'shootoutConversionFactor', label: 'Conversão na disputa por pênaltis', hint: 'Usado no desempate da Taça', min: 0.5, max: 1.0, step: 0.01 },
]

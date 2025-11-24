// ==================== CÁLCULO DE PROBABILIDADE REAL ====================

interface FormData {
  form: string
}

interface GameDataForProb {
  awayForm: string
  awayOdd: number
}

interface HTDataForProb {
  shotsOnTargetHome: number
  shotsOnTargetAway: number
  dangerousAttacksHome: number
  dangerousAttacksAway: number
  halftimeScore: string
  pressureIndex: number
}

/**
 * Calcula score baseado na forma recente (V, E, D)
 * V = 20 pontos, E = 10 pontos, D = 0 pontos
 */
export function scoreForm(form: string): number {
  if (!form || form.length === 0) return 0
  
  const victories = (form.match(/V/g) || []).length
  const draws = (form.match(/E/g) || []).length
  
  return (victories * 20 + draws * 10)
}

/**
 * Calcula probabilidade real para PRÉ-JOGO
 * Baseado em forma recente e odds (SEM xG)
 * xG real só será aplicado em jogos ao vivo no módulo HT → FT (Live)
 */
export function calculateRealProbability(data: GameDataForProb): number {
  // Fator forma (60% do peso)
  const formFactor = scoreForm(data.awayForm)
  
  // Fator odds (40% do peso) - quanto maior a odd do visitante, menor a probabilidade implícita
  const oddFactor = (1 / data.awayOdd) * 100
  
  // Probabilidade combinada
  const realProb = formFactor * 0.6 + oddFactor * 0.4
  
  return Math.max(0, Math.min(100, realProb))
}

/**
 * Calcula probabilidade real para HT → FT
 * Baseado em estatísticas do 1º tempo e pressão
 * xG é estimado a partir de finalizações no alvo, chutes totais, ataques perigosos
 */
export function calculateRealProbabilityHT(
  htData: HTDataForProb,
  haLine: string
): number {
  let realProb = 50 // base
  
  // Ajustar por pressão (peso alto)
  const pressureIndex = htData.pressureIndex
  if (pressureIndex >= 70) realProb += 15
  else if (pressureIndex >= 55) realProb += 10
  else if (pressureIndex >= 40) realProb += 5
  else realProb -= 5
  
  // Ajustar por finalizações no alvo (estimativa de xG)
  const totalShotsOnTarget = htData.shotsOnTargetHome + htData.shotsOnTargetAway
  const shotsOnTargetRatio = totalShotsOnTarget > 0 
    ? htData.shotsOnTargetAway / totalShotsOnTarget 
    : 0.5
  realProb += (shotsOnTargetRatio - 0.5) * 20
  
  // Ajustar por ataques perigosos (estimativa de xG)
  const totalDangerousAttacks = htData.dangerousAttacksHome + htData.dangerousAttacksAway
  const dangerousAttacksRatio = totalDangerousAttacks > 0
    ? htData.dangerousAttacksAway / totalDangerousAttacks
    : 0.5
  realProb += (dangerousAttacksRatio - 0.5) * 15
  
  // Ajustar por placar
  const [homeScore, awayScore] = htData.halftimeScore.split("-").map(Number)
  const scoreDiff = homeScore - awayScore
  if (scoreDiff >= 2) realProb -= 10
  else if (scoreDiff === 1) realProb -= 5
  else if (scoreDiff === 0) realProb += 5
  else if (scoreDiff === -1) realProb += 10
  
  // Ajustar por linha do HA+ (linhas mais altas = mais conservador)
  const lineValue = parseFloat(haLine.replace("+", ""))
  if (lineValue >= 1.25) realProb += 5 // Linha conservadora aumenta probabilidade
  else if (lineValue <= 0.5) realProb -= 3 // Linha agressiva reduz um pouco
  
  return Math.max(0, Math.min(100, realProb))
}

/**
 * Calcula probabilidade implícita da odd
 */
export function calculateImpliedProbability(odd: number): number {
  return (1 / odd) * 100
}

/**
 * Calcula EV (Expected Value)
 */
export function calculateEV(realProb: number, impliedProb: number): number {
  return realProb - impliedProb
}

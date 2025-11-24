// ==================== DETECÇÃO DE RED FLAGS ====================

import { THRESHOLDS } from "./filtroCampeaoConfig"

export interface RedFlag {
  type: "CRÍTICA" | "MODERADA"
  message: string
}

interface GameData {
  homeOdd: number
  awayOdd: number
}

interface HTSummary {
  halftimeScore: string
  shotsTotalHome: number
  shotsTotalAway: number
  shotsOnTargetHome: number
  shotsOnTargetAway: number
  dangerousAttacksHome: number
  dangerousAttacksAway: number
  possessionHome: number
  possessionAway: number
  cornersHome: number
  cornersAway: number
  yellowHome: number
  yellowAway: number
  redHome: number
  redAway: number
}

/**
 * Detecta Red Flags no PRÉ-JOGO
 * 
 * NOTA: xG NÃO é usado no pré-jogo (só no HT → FT Live)
 * Red flags baseadas em odds e forma recente
 */
export function detectRedFlagsPreGame(data: GameData): RedFlag[] {
  const flags: RedFlag[] = []
  
  // 1. Odd do visitante muito baixa (favorito disfarçado)
  if (data.awayOdd < 1.5) {
    flags.push({
      type: "CRÍTICA",
      message: `Visitante é favorito (odd ${data.awayOdd.toFixed(2)}) - não é underdog real`
    })
  }
  
  // 2. Odd do mandante muito baixa (favorito esmagador)
  if (data.homeOdd < 1.3) {
    flags.push({
      type: "MODERADA",
      message: `Mandante favorito esmagador (odd ${data.homeOdd.toFixed(2)}) - cenário difícil para HA+`
    })
  }
  
  // 3. Diferença de odds muito grande (favorito muito forte)
  const oddRatio = data.homeOdd / data.awayOdd
  if (oddRatio < 0.4) {
    flags.push({
      type: "CRÍTICA",
      message: `Favorito muito forte (ratio de odds: ${oddRatio.toFixed(2)}) - risco alto para HA+`
    })
  }
  
  return flags
}

/**
 * Detecta Red Flags no HT → FT
 * 
 * NOTA: xG é ESTIMADO a partir de estatísticas do 1º tempo
 * (finalizações no alvo, chutes totais, ataques perigosos)
 */
export function detectRedFlagsHT(
  htData: HTSummary,
  minute: number,
  pressureIndex: number
): RedFlag[] {
  const flags: RedFlag[] = []
  
  const [homeScore, awayScore] = htData.halftimeScore.split("-").map(Number)
  const scoreDiff = homeScore - awayScore
  
  // 1. CRÍTICA: Jogador expulso no time analisado (visitante)
  if (htData.redAway > 0) {
    flags.push({
      type: "CRÍTICA",
      message: "Jogador expulso no time sugerido (visitante) - VETO ABSOLUTO"
    })
  }
  
  // 2. CRÍTICA: Duas ou mais expulsões no jogo (caos)
  if (htData.redHome + htData.redAway >= 2) {
    flags.push({
      type: "CRÍTICA",
      message: "Duas ou mais expulsões no jogo - cenário caótico"
    })
  }
  
  // 3. CRÍTICA: Perdendo por 2+ gols sem pressão ofensiva
  if (scoreDiff >= THRESHOLDS.redFlags.scoreDiffCritical && pressureIndex < THRESHOLDS.redFlags.minPressureWhenLosing) {
    flags.push({
      type: "CRÍTICA",
      message: `Perdendo por ${scoreDiff}+ gol(s) sem pressão ofensiva (índice: ${pressureIndex})`
    })
  }
  
  // 4. CRÍTICA: Minuto avançado (≥80) com pressão baixa
  if (minute >= THRESHOLDS.redFlags.criticalMinute && pressureIndex < THRESHOLDS.redFlags.minPressureForLateGame) {
    flags.push({
      type: "CRÍTICA",
      message: `Minuto ≥ ${THRESHOLDS.redFlags.criticalMinute} com pressão baixa (${pressureIndex}) - tempo insuficiente`
    })
  }
  
  // 5. MODERADA: Muitos cartões amarelos no visitante (risco de expulsão)
  if (htData.yellowAway >= THRESHOLDS.redFlags.maxYellowsBeforeWarning) {
    flags.push({
      type: "MODERADA",
      message: `${htData.yellowAway} cartões amarelos no visitante - risco de expulsão`
    })
  }
  
  // 6. MODERADA: Jogo muito faltoso (5+ amarelos)
  if (htData.yellowHome + htData.yellowAway >= THRESHOLDS.redFlags.maxTotalYellows) {
    flags.push({
      type: "MODERADA",
      message: `Jogo muito faltoso (${htData.yellowHome + htData.yellowAway} amarelos) - risco de caos`
    })
  }
  
  // 7. MODERADA: Perdendo por 3+ gols (cenário muito difícil)
  if (scoreDiff >= 3) {
    flags.push({
      type: "MODERADA",
      message: `Perdendo por ${scoreDiff} gol(s) - cenário muito adverso`
    })
  }
  
  // 8. MODERADA: Sem finalizações no alvo (sem perigo real)
  if (htData.shotsOnTargetAway === 0 && minute >= 30) {
    flags.push({
      type: "MODERADA",
      message: "Sem finalizações no alvo - sem perigo ofensivo real"
    })
  }
  
  // 9. MODERADA: Posse muito baixa (<30%) e sem contra-ataques efetivos
  if (htData.possessionAway < 30 && htData.dangerousAttacksAway < 20) {
    flags.push({
      type: "MODERADA",
      message: `Posse muito baixa (${htData.possessionAway}%) sem contra-ataques efetivos`
    })
  }
  
  // 10. CRÍTICA: xG fraudado por pênalti isolado
  // (Detectar se tem gol mas poucas finalizações)
  if (awayScore > 0 && htData.shotsTotalAway <= 3 && htData.shotsOnTargetAway <= 1) {
    flags.push({
      type: "CRÍTICA",
      message: "Possível gol de pênalti isolado - xG distorcido"
    })
  }
  
  return flags
}

/**
 * Verifica se existe alguma Red Flag CRÍTICA
 */
export function hasCriticalRedFlag(flags: RedFlag[]): boolean {
  return flags.some(flag => flag.type === "CRÍTICA")
}

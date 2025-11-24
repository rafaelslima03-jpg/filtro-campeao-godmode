// ==================== RADAR AUTOMÁTICO PRO ====================
// Lógica de cálculo RDS, mini-filtro e scores para o Radar

export const RADAR_LEAGUES = [
  { id: 71, name: "Brasileirão A", weight: 1.00 },
  { id: 72, name: "Brasileirão B", weight: 0.95 },
  { id: 73, name: "Copa do Brasil", weight: 0.85 },
  { id: 128, name: "Argentina A", weight: 0.80 },
  { id: 266, name: "Uruguai A", weight: 0.75 }
]

export interface RadarGameStats {
  shotsOnTarget: number
  totalShots: number
  possession: number
  corners: number
  dangerousAttacks?: number
}

export interface RadarGame {
  fixtureId: number
  leagueId: number
  leagueName: string
  importanceWeight: number
  homeTeam: string
  awayTeam: string
  scoreHome: number
  scoreAway: number
  minute: number
  scoreRadarFinal: number
  goldSignal: boolean
  criteriosQueBateram: string[]
  stats: {
    home: RadarGameStats
    away: RadarGameStats
    rdsHome: number
    rdsAway: number
    rdsDiff: number
  }
  odds?: {
    home: number
    draw: number
    away: number
  }
}

// ==================== RDS - REAL DOMINANCE SCORE ====================

export function calculateRDS(stats: RadarGameStats): number {
  const rawScore = 
    (stats.shotsOnTarget * 2.5) +
    (stats.totalShots * 1.0) +
    (stats.possession * 0.8) +
    (stats.corners * 1.2)

  // Normalizar para 0-100
  // Valores típicos: 0-150 raw -> 0-100 normalized
  const normalized = Math.min(100, (rawScore / 150) * 100)
  
  return Math.round(normalized)
}

// ==================== MINI-FILTRO CAMPEÃO ====================

export function applyMiniFiltro(
  homeStats: RadarGameStats,
  awayStats: RadarGameStats,
  rdsHome: number,
  rdsAway: number,
  redHome: number,
  redAway: number
): { passed: boolean; reasons: string[] } {
  const reasons: string[] = []

  // RED FLAG CRÍTICA: Expulsão contra o underdog
  if (redAway > 0) {
    return { passed: false, reasons: ["❌ Expulsão contra o underdog"] }
  }

  // Verificar equilíbrio ofensivo
  const rdsRatio = rdsAway / (rdsHome + 0.01)
  const shotsOnTargetRatio = awayStats.shotsOnTarget / (homeStats.shotsOnTarget + awayStats.shotsOnTarget + 0.01)
  const possessionRatio = awayStats.possession / 100

  let passed = false

  // Critérios de aprovação (OU lógico)
  if (rdsRatio >= 0.80) {
    passed = true
    reasons.push("✅ RDS ≥ 80% do favorito")
  }

  if (shotsOnTargetRatio >= 0.40) {
    passed = true
    reasons.push("✅ Finalizações no alvo ≥ 40%")
  }

  if (possessionRatio >= 0.40) {
    passed = true
    reasons.push("✅ Posse ≥ 40%")
  }

  // Equilíbrio ofensivo consistente
  if (awayStats.totalShots >= 5 && awayStats.shotsOnTarget >= 2) {
    passed = true
    reasons.push("✅ Equilíbrio ofensivo consistente")
  }

  if (!passed) {
    reasons.push("❌ Não atingiu critérios mínimos de equilíbrio")
  }

  return { passed, reasons }
}

// ==================== SCORE RADAR ====================

export function calculateScoreRadar(
  homeStats: RadarGameStats,
  awayStats: RadarGameStats,
  rdsHome: number,
  rdsAway: number,
  scoreHome: number,
  scoreAway: number,
  minute: number,
  importanceWeight: number,
  odds?: { home: number; draw: number; away: number }
): { scoreRadarFinal: number; goldSignal: boolean; criterios: string[] } {
  const criterios: string[] = []

  // 1. Equilíbrio Ofensivo (0-100)
  const shotsRatio = awayStats.totalShots / (homeStats.totalShots + awayStats.totalShots + 0.01)
  const shotsOnTargetRatio = awayStats.shotsOnTarget / (homeStats.shotsOnTarget + awayStats.shotsOnTarget + 0.01)
  const equilibrioOfensivo = ((shotsRatio + shotsOnTargetRatio) / 2) * 100

  if (equilibrioOfensivo >= 40) {
    criterios.push(`Equilíbrio Ofensivo: ${equilibrioOfensivo.toFixed(0)}%`)
  }

  // 2. RDS Factor (0-100)
  const rdsDiff = rdsAway - rdsHome
  const rdsFactor = Math.min(100, Math.max(0, 50 + rdsDiff))

  if (rdsFactor >= 45) {
    criterios.push(`RDS Factor: ${rdsFactor.toFixed(0)}`)
  }

  // 3. Contexto do Placar (0-100)
  const scoreDiff = scoreHome - scoreAway
  let contextoPlacar = 50

  if (scoreDiff === 0) {
    contextoPlacar = 80
    criterios.push("Placar empatado (favorável)")
  } else if (scoreDiff === 1) {
    contextoPlacar = 65
    criterios.push("Perdendo por 1 (aceitável)")
  } else if (scoreDiff === -1) {
    contextoPlacar = 90
    criterios.push("Ganhando por 1 (excelente)")
  } else if (scoreDiff >= 2) {
    contextoPlacar = 30
    criterios.push("Perdendo por 2+ (arriscado)")
  } else if (scoreDiff <= -2) {
    contextoPlacar = 95
    criterios.push("Ganhando por 2+ (muito favorável)")
  }

  // 4. Fator Minuto (0-100)
  let minutoFactor = 100
  if (minute >= 80) {
    minutoFactor = 40
    criterios.push("Minuto ≥ 80 (tempo limitado)")
  } else if (minute >= 70) {
    minutoFactor = 60
    criterios.push("Minuto 70-79 (tempo moderado)")
  } else if (minute >= 60) {
    minutoFactor = 80
    criterios.push("Minuto 60-69 (tempo bom)")
  } else {
    criterios.push("Minuto < 60 (tempo suficiente)")
  }

  // Score Base
  const scoreBase = 
    (equilibrioOfensivo * 0.35) +
    (rdsFactor * 0.35) +
    (contextoPlacar * 0.20) +
    (minutoFactor * 0.10)

  // Score Final com peso da liga
  const scoreRadarFinal = Math.round(scoreBase * importanceWeight)

  // Gold Signal
  let goldSignal = false
  const underdogStatsBoas = rdsAway >= (rdsHome * 0.75) && awayStats.shotsOnTarget >= 2
  const weightOk = importanceWeight >= 0.80
  const oddsOk = odds ? (odds.away >= 1.8 && odds.away <= 3.5) : true

  if (underdogStatsBoas && weightOk && oddsOk) {
    goldSignal = true
    criterios.push("🏆 GOLD SIGNAL")
  }

  return { scoreRadarFinal, goldSignal, criterios }
}

// ==================== PRÉ-LIVE SCORE ====================

export function calculatePreLiveScore(
  favorito: string,
  underdog: string,
  odds: { home: number; draw: number; away: number },
  importanceWeight: number,
  standings?: { homePosition: number; awayPosition: number }
): { scoreRadarPreLive: number; goldSignal: boolean; criterios: string[] } {
  const criterios: string[] = []

  // Identificar favorito/underdog pelas odds
  const isFavoritoHome = odds.home < odds.away
  const favoritoOdd = isFavoritoHome ? odds.home : odds.away
  const underdogOdd = isFavoritoHome ? odds.away : odds.home

  // 1. Range de odds ideal (1.40-4.00)
  let oddsScore = 50
  if (underdogOdd >= 1.8 && underdogOdd <= 3.5) {
    oddsScore = 80
    criterios.push(`Odd ideal: ${underdogOdd.toFixed(2)}`)
  } else if (underdogOdd >= 1.4 && underdogOdd <= 4.0) {
    oddsScore = 65
    criterios.push(`Odd aceitável: ${underdogOdd.toFixed(2)}`)
  } else {
    criterios.push(`Odd fora do ideal: ${underdogOdd.toFixed(2)}`)
  }

  // 2. Diferença de força (baseado em odds)
  const oddRatio = favoritoOdd / underdogOdd
  let forcaScore = 50
  if (oddRatio >= 0.4 && oddRatio <= 0.7) {
    forcaScore = 80
    criterios.push("Diferença de força equilibrada")
  } else if (oddRatio >= 0.3 && oddRatio <= 0.8) {
    forcaScore = 65
    criterios.push("Diferença de força moderada")
  } else {
    criterios.push("Diferença de força desequilibrada")
  }

  // 3. Suspeita de favorito inflado
  let infladoScore = 70
  if (favoritoOdd < 1.5 && underdogOdd > 2.5) {
    infladoScore = 85
    criterios.push("Favorito possivelmente inflado")
  }

  // 4. Perfil bom para HA+
  let perfilScore = 70
  if (underdogOdd >= 2.0 && underdogOdd <= 3.0) {
    perfilScore = 85
    criterios.push("Perfil ideal para HA+")
  }

  // Score Base
  const scoreBase = 
    (oddsScore * 0.35) +
    (forcaScore * 0.30) +
    (infladoScore * 0.20) +
    (perfilScore * 0.15)

  // Score Final com peso da liga
  const scoreRadarPreLive = Math.round(scoreBase * importanceWeight)

  // Gold Signal
  let goldSignal = false
  if (
    underdogOdd >= 1.8 && 
    underdogOdd <= 3.5 && 
    importanceWeight >= 0.80 &&
    oddRatio >= 0.4
  ) {
    goldSignal = true
    criterios.push("🏆 GOLD SIGNAL PRÉ-LIVE")
  }

  return { scoreRadarPreLive, goldSignal, criterios }
}

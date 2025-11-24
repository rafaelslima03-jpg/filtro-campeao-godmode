// ==================== CONFIGURAÇÕES DO FILTRO CAMPEÃO ====================

export const ODD_MIN = 1.4
export const ODD_MAX = 3.5

export const WEIGHTS = {
  tactical: 0.25,
  statistical: 0.25,
  ev: 0.3,
  confidence: 0.2
}

export const PRESSURE_WEIGHTS = {
  shotsOnTarget: 30,
  shotsTotal: 15,
  dangerousAttacks: 30,
  corners: 15,
  possession: 10
}

export const THRESHOLDS = {
  // Modo Ultra Conservador
  ultraConservador: {
    minConfidence: 70,
    minEV: 4,
    minPressure: 55
  },
  
  // Modo Normal
  normal: {
    highConfidence: 75,
    highEV: 5,
    goodConfidence: 65,
    goodEV: 3,
    moderateConfidence: 55,
    moderateEV: 2
  },
  
  // HT → FT
  htft: {
    highProb: 68,
    highEV: 3,
    goodProb: 62,
    goodEV: 2,
    moderateProb: 55,
    moderateEV: 1
  },
  
  // Red Flags
  redFlags: {
    maxYellowsBeforeWarning: 3,
    maxTotalYellows: 5,
    criticalMinute: 80,
    minPressureForLateGame: 45,
    scoreDiffCritical: 2,
    minPressureWhenLosing: 40
  }
}

export const HANDICAP_LINES = [
  "+0.25",
  "+0.5",
  "+0.75",
  "+1.0",
  "+1.25",
  "+1.5",
  "+1.75",
  "+2.0"
] as const

export type HandicapLine = typeof HANDICAP_LINES[number]

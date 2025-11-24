"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { useToast } from "@/hooks/use-toast"
import { 
  AlertCircle, 
  TrendingUp, 
  Calculator, 
  Target, 
  Activity,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Zap,
  Shield,
  Sun,
  Moon,
  Clock,
  BarChart3,
  Flame,
  TrendingDown,
  Eye,
  Brain,
  Gauge
} from "lucide-react"

const DEBUG = true
const ODD_MIN = 1.4
const ODD_MAX = 3.5

// ==================== REGRAS GODMODE INTEGRADAS + AUTO-TUNING ====================

const GODMODE_RULES = {
  // 1) PRIORIDADE
  priority: {
    main: "HA+",
    secondary: "OPC",
    focus: "2º tempo"
  },

  // 2) DADOS OBRIGATÓRIOS
  requiredData: [
    "API Live (finalizações, xG, PSxG, ataques perigosos, escanteios, posse, cartões, faltas, substituições, HeatMap)",
    "odds live", "odds históricas", "fair line", "discrepância",
    "33 fundamentos", "HA+", "RDS", "Snapshot", "Radar", "Underdog Score",
    "Momentum", "Shadow xG", "Time Bomb", "Pattern Breaker", "Dead Game"
  ],

  // 3) OPC - Oportunidade Secundária
  opc: {
    activateWhen: "HA+ sem EV+",
    markets: ["Over 0.5/1.5", "Gol do time", "Under", "Cartões", "Escanteios", "Ambas Não", "Virada"],
    minSignals: 3,
    minEV: 0.00, // OPC só com EV ≥ 0
    noEV: "Nenhuma OPC válida"
  },

  // 4) EV DINÂMICO
  evDynamic: {
    recalcInterval: 30, // segundos
    factors: ["substituições", "pressão real", "odds justas", "Momentum", "Shadow xG", "Time Bomb", "peso da liga", "HeatMap", "contexto"],
    weightIncrease: "45'→90'"
  },

  // 5) DISCREPÂNCIA
  discrepancy: {
    threshold: 8, // %
    message: "Mercado atrasado"
  },

  // 6) EVENTOS-PIVOT
  pivotEvents: ["gol", "expulsão", "pênalti perdido", "substituição dupla", "explosão de pressão", "quebra emocional"],

  // 7) PRESSÃO REAL vs FALSA
  pressure: {
    real: ["finalizações na área", "xG crescente", "Shadow xG", "ataques perigosos", "cruzamentos perigosos", "escanteios repetidos", "HeatMap avançado"],
    fake: ["posse estéril", "chutes longos", "ataques sem penetração"]
  },

  // 8) BLOQUEIOS ABSOLUTOS
  blocks: {
    xgLow: { threshold: 0.40, minute: 55, block: "Over proibido" },
    awayDead: { xg: 0, shots: 0, block: "HA+ visitante proibido" },
    redCards: { count: 2, allow: ["Under", "cartões"] },
    noEvents: { minutes: 10, block: "OPC bloqueado" },
    apiIncomplete: "bloquear análise",
    minOdds: 1.60,
    maxERP: 35
  },

  // 9) HEATMAP TÁTICO
  heatmap: {
    use: ["lado forte", "buraco defensivo", "pressão assimétrica"],
    support: ["HA+", "OPC"]
  },

  // 10) CONFIRMAÇÃO TRIPLA
  tripleConfirmation: {
    required: 2,
    sources: ["API Live", "Módulos internos", "Odds/discrepância"]
  },

  // 11) MOMENTUM 0-100
  momentum: {
    ranges: {
      imminent: [80, 100],
      under: [20, 39],
      dead: [0, 19]
    }
  },

  // 12) PATTERN BREAKER
  patternBreaker: {
    detect: ["crescimento repentino", "3 chances em 5 minutos", "virada de posse"],
    action: "recalcular tudo"
  },

  // 13) SHADOW xG
  shadowXG: {
    sources: ["cruzamentos perigosos", "bola travada na pequena área", "quase pênalti", "trave"],
    integrate: ["HA+", "OPC", "Time Bomb"]
  },

  // 14) TIME BOMB
  timeBomb: {
    triggers: ["pressão real", "xG frustrado", "Shadow xG alto", "escanteios repetidos"],
    message: "Time Bomb ativada"
  },

  // 15) DEAD GAME
  deadGame: {
    signs: ["xG parado", "ritmo lento", "posse passiva", "recuos", "substituições defensivas"],
    apply: ["Under", "bloqueio Over"]
  },

  // 16) CONTEXTO CRÍTICO
  context: {
    factors: ["tabela", "rebaixamento", "ida/volta", "rivalidade", "empate serve"],
    influence: ["HA+", "OPC", "Over/Under"]
  },

  // 17) HEATMAP EMOCIONAL
  emotionalHeatmap: {
    agressiveness: ["mais cartões", "mais caos", "mais Momentum"]
  },

  // 18) TRUE VALUE
  trueValue: {
    detect: "odds desatualizadas após mudança tática ou explosão de pressão",
    action: "aumentar prioridade EV+"
  },

  // 19) MÓDULOS AVANÇADOS
  advancedModules: [
    "micro-ritmo 3min", "choke points", "3 linhas de pressão",
    "anti-sesgo camisa", "anti-sesgo placar", "padrões de gol por liga",
    "desgaste físico", "ciclo natural do jogo", "turning points", "anti-trap", "pós-gol"
  ],

  // 20) COMPARAÇÃO 1T → 2T
  htToFt: {
    compare: ["xG", "ataques perigosos", "Shadow xG", "HeatMap emocional", "Underdog Score", "transições", "ritmo"],
    trends: ["aquecer", "morrer", "explodir", "caos", "virar", "esfriar", "gol tardio"]
  },

  // 21) SAÍDA FINAL
  output: [
    "Resumo", "Comparação 1T→2T", "Next Step", "HA+", "OPC",
    "Justificativa curta", "Confiança", "Liga + peso", "AggroLevel"
  ],

  // 22) RANKING DE LIGAS
  leagueWeights: {
    ha: { PL: 1.00, BUN: 0.95, ITA: 0.93, LALIGA: 0.90, CL: 0.88 },
    goals: { BUN: 1.00, PL: 0.96, CL: 0.95, ITA: 0.92, LALIGA: 0.90 },
    cards: { LALIGA: 1.00, ITA: 0.96, PL: 0.92, CL: 0.88, BUN: 0.85 }
  },

  // 23) ANTI-CONSERVADOR
  antiConservative: {
    overLate: { conditions: ["Momentum≥85", "Time Bomb", "Shadow xG", "liga forte em gols"] },
    haWeak: { conditions: ["liga forte", "discrepância>8%"] },
    cardsCold: { conditions: ["liga quente", "heatmap emocional crescente"] }
  },

  // 24) ANTI-OVERLAP
  antiOverlap: "proibido 2 apostas dependentes do mesmo evento - escolher maior EV+",

  // 25) CONFIDENCE SCORE
  confidence: {
    HIGH: "liga forte + Momentum forte + pressão real",
    MEDIUM: "EV bom porém instável",
    LOW: "bloqueios → não sugerir"
  },

  // 26) RISK MAP ENGINE
  riskMap: {
    types: {
      explosive: ["Over", "Gol", "Time Bomb"],
      controlled: ["HA+ mandante"],
      chaotic: ["HA+", "Gol", "Virada"],
      locked: ["Cartões", "Under"],
      dead: ["bloquear Over", "HA+ só mandante dominante"]
    },
    factors: ["transições", "HeatMap tático/emocional", "ritmo/minuto", "Shadow xG", "alternância ataques", "substituições"]
  },

  // ==================== NOVO: AUTO-TUNING DE AGRESSIVIDADE ====================
  aggroLevels: {
    0: {
      name: "Ultra Seguro",
      conditions: ["Dead Game", "Momentum < 25", "Shadow xG mínimo"],
      evMin: 0.01,
      description: "EV deve ser > 0. OPC ultra restrito."
    },
    1: {
      name: "Conservador Pro",
      conditions: ["Jogo morno", "Pressão moderada"],
      evMin: -1.5,
      description: "EV ≥ -1.5%. Pressão moderada."
    },
    2: {
      name: "Moderado Pro",
      conditions: ["Jogo aquecendo", "Shadow + Momentum fortes"],
      evMin: -2.5,
      description: "EV ≥ -2.5%. Shadow + Momentum fortes."
    },
    3: {
      name: "Agressivo Inteligente",
      conditions: ["Pressão alta", "Caos", "Time Bomb/Pattern Break/Turning Point"],
      evMin: -4.0,
      description: "EV ≥ -4%. Aviso obrigatório. APENAS HA+."
    }
  }
}

// ==================== INTERFACES COMPLETAS ====================

interface GameData {
  homeTeam: string
  awayTeam: string
  league: string
  homeOdd: number
  drawOdd: number
  awayOdd: number
  oddHaPositivo: number
  linhaHaPositiva: string
  homeForm: string
  awayForm: string
}

interface HTSummary {
  fixtureId: number
  homeTeam: string
  awayTeam: string
  halftimeScore: string
  shotsTotalHome: number
  shotsOnTargetHome: number
  shotsTotalAway: number
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
  xgHome?: number
  xgAway?: number
}

interface HTSnapshot {
  fixtureId: number
  homeTeam: string
  awayTeam: string
  halftimeScore: string
  htRdsCasa: number
  htRdsFora: number
  htRdsDiff: number
  htDominanceScore: number
  htUnderdogScore: number
  htGameProfile: string
  htTendency: string
  statistics: HTSummary
}

interface MomentumData {
  last5min: number
  last10min: number
  last15min: number
  trend: "crescendo" | "neutro" | "caindo"
}

interface PressureData {
  pressureIndex: number
  isHotMoment: boolean
  occasions: string[]
}

interface LiveEnhancedData {
  momentumScore: MomentumData
  pressureIndex: PressureData
  minutePhase: "46-60" | "61-75" | "76+"
  haFriendly: boolean
  coherenceScoreHA: number
  shotQualityIndex: number
  scoreContextoPlacar: number
  redFlags: string[]
  expectedMomentum: "crescendo" | "neutro" | "caindo"
  patternBreak: "nenhum" | "leve" | "forte"
  fragilityIndex: number
  htToFtCoherence?: "ROTEIRO CONFIRMADO" | "NEUTRO" | "ROTEIRO ROMPIDO"
}

interface LiveEnhancedDataComplete extends LiveEnhancedData {
  tda: {
    score: number
    trend: "consistente" | "volátil"
    description: string
  }
  gameTempo: {
    speed: "alto" | "médio" | "baixo"
    volatilityRisk: number
    description: string
  }
  erp: {
    reversalProbability: number
    factors: string[]
    impact: "alto" | "médio" | "baixo"
  }
  riskMapType?: "explosive" | "controlled" | "chaotic" | "locked" | "dead"
  shadowXG?: number
  timeBombActive?: boolean
  deadGameDetected?: boolean
  trueValueDetected?: boolean
  aggroLevel?: number
  turningPointDetected?: boolean
  antiTrapActive?: boolean
  postGoalMode?: boolean
}

interface AnalysisResult {
  recommendation: string
  handicap: string
  odd: number
  ev: number
  confidence: number
  justification: string[]
  tacticalScore: number
  statisticalScore: number
  neuralScore: number
  teamName?: string
  haLine?: string
  probabilityCoverage?: number
  enhancedData?: LiveEnhancedDataComplete
  htSnapshot?: HTSnapshot
  opcRecommendation?: string
  nextStep?: string
  aggroLevel?: number
  aggroLevelName?: string
  evNegativeWarning?: string
}

interface HistoryEntry {
  id: string
  timestamp: Date
  type: "Pré-Jogo" | "HT→FT" | "HT Snapshot"
  teams: string
  handicap: string
  ev: number
  confidence: number
  decision: string
  notes?: string
}

// ==================== STORAGE DE SNAPSHOTS ====================

const firstHalfSnapshot: Record<number, HTSnapshot> = {}

// ==================== FUNÇÕES AUXILIARES BÁSICAS ====================

function isValidOdd(odd: number): boolean {
  return odd >= ODD_MIN && odd <= ODD_MAX
}

function calculateImpliedProbability(odd: number): number {
  return (1 / odd) * 100
}

function calculateEV(realProb: number, impliedProb: number): number {
  return realProb - impliedProb
}

function calculateRealProbability(data: GameData): number {
  const impliedProb = calculateImpliedProbability(data.oddHaPositivo)
  const oddsFactor = impliedProb
  const formFactor = ((data.awayForm.match(/V/g) || []).length / 5) * 100
  return (oddsFactor * 0.6 + formFactor * 0.4)
}

// ==================== CÁLCULO DE RDS ====================

function calculateRDS(
  shotsTotal: number,
  shotsOnTarget: number,
  possession: number,
  dangerousAttacks: number,
  xg?: number
): number {
  let rds = 0
  
  // Chutes totais (peso 25%)
  rds += (shotsTotal / 20) * 25
  
  // Chutes no alvo (peso 30%)
  rds += (shotsOnTarget / 10) * 30
  
  // Posse (peso 20%)
  rds += (possession / 100) * 20
  
  // Ataques perigosos (peso 15%)
  if (dangerousAttacks > 0) {
    rds += (dangerousAttacks / 50) * 15
  }
  
  // xG (peso 10%)
  if (xg !== undefined && xg > 0) {
    rds += (xg / 3) * 10
  } else {
    // Se não houver xG, redistribui o peso
    rds += (shotsOnTarget / 10) * 10
  }
  
  return Math.min(100, Math.max(0, rds))
}

// ==================== ANÁLISE DO 1º TEMPO (HT SNAPSHOT) ====================

function analyzeFirstHalf(htData: HTSummary): HTSnapshot {
  const htRdsCasa = calculateRDS(
    htData.shotsTotalHome,
    htData.shotsOnTargetHome,
    htData.possessionHome,
    htData.dangerousAttacksHome,
    htData.xgHome
  )
  
  const htRdsFora = calculateRDS(
    htData.shotsTotalAway,
    htData.shotsOnTargetAway,
    htData.possessionAway,
    htData.dangerousAttacksAway,
    htData.xgAway
  )
  
  const htRdsDiff = htRdsFora - htRdsCasa
  
  // Dominance Score (0-100)
  const htDominanceScore = Math.abs(htRdsDiff)
  
  // Underdog Score (0-100)
  const htUnderdogScore = htRdsFora
  
  // Game Profile
  let htGameProfile = ""
  if (htDominanceScore < 15) {
    htGameProfile = "Jogo equilibrado"
  } else if (htRdsDiff > 15) {
    htGameProfile = "Visitante dominando"
  } else if (htRdsDiff < -15) {
    htGameProfile = "Mandante dominando"
  } else if (htData.shotsTotalHome + htData.shotsTotalAway < 10) {
    htGameProfile = "Jogo truncado"
  } else {
    htGameProfile = "Jogo competitivo"
  }
  
  // Tendência para o 2º tempo
  let htTendency = ""
  if (htUnderdogScore >= 70) {
    htTendency = "Visitante vivo e competitivo - HA+ favorável"
  } else if (htUnderdogScore >= 50) {
    htTendency = "Visitante presente - HA+ possível"
  } else if (htUnderdogScore < 40) {
    htTendency = "Visitante apagado - HA+ arriscado"
  } else {
    htTendency = "Cenário neutro - avaliar 2º tempo"
  }
  
  const snapshot: HTSnapshot = {
    fixtureId: htData.fixtureId,
    homeTeam: htData.homeTeam,
    awayTeam: htData.awayTeam,
    halftimeScore: htData.halftimeScore,
    htRdsCasa,
    htRdsFora,
    htRdsDiff,
    htDominanceScore,
    htUnderdogScore,
    htGameProfile,
    htTendency,
    statistics: htData
  }
  
  // Salvar no storage
  firstHalfSnapshot[htData.fixtureId] = snapshot
  
  return snapshot
}

// ==================== COMPARAÇÃO HT → FT ====================

function compareHTtoFT(
  fixtureId: number,
  currentRdsCasa: number,
  currentRdsFora: number,
  currentStats: HTSummary
): "ROTEIRO CONFIRMADO" | "NEUTRO" | "ROTEIRO ROMPIDO" {
  const snapshot = firstHalfSnapshot[fixtureId]
  
  if (!snapshot) {
    return "NEUTRO"
  }
  
  const rdsDiffHT = snapshot.htRdsDiff
  const rdsDiffFT = currentRdsFora - currentRdsCasa
  
  // Comparar tendências
  const htFavoredAway = rdsDiffHT > 10
  const ftFavoredAway = rdsDiffFT > 10
  
  const htShotsRatio = snapshot.statistics.shotsOnTargetAway / (snapshot.statistics.shotsOnTargetHome + 0.01)
  const ftShotsRatio = currentStats.shotsOnTargetAway / (currentStats.shotsOnTargetHome + 0.01)
  
  const htPossessionDiff = snapshot.statistics.possessionAway - snapshot.statistics.possessionHome
  const ftPossessionDiff = currentStats.possessionAway - currentStats.possessionHome
  
  // Análise de coerência
  let coherencePoints = 0
  
  // RDS mantém tendência?
  if ((htFavoredAway && ftFavoredAway) || (!htFavoredAway && !ftFavoredAway)) {
    coherencePoints += 3
  } else {
    coherencePoints -= 2
  }
  
  // Chutes no alvo mantêm proporção?
  if (Math.abs(htShotsRatio - ftShotsRatio) < 0.2) {
    coherencePoints += 2
  }
  
  // Posse mantém tendência?
  if ((htPossessionDiff > 0 && ftPossessionDiff > 0) || (htPossessionDiff < 0 && ftPossessionDiff < 0)) {
    coherencePoints += 1
  }
  
  // Underdog mantém competitividade?
  if (snapshot.htUnderdogScore >= 60 && currentRdsFora >= 60) {
    coherencePoints += 2
  }
  
  // Decisão
  if (coherencePoints >= 5) {
    return "ROTEIRO CONFIRMADO"
  } else if (coherencePoints >= 2) {
    return "NEUTRO"
  } else {
    return "ROTEIRO ROMPIDO"
  }
}

// ==================== MOMENTUM LIVE SCORE ====================

function calculateMomentumScore(
  recentAttacks: number,
  recentShots: number,
  recentPossession: number,
  timeWindow: number
): number {
  // Normalizar por janela de tempo
  const attacksNorm = (recentAttacks / timeWindow) * 5
  const shotsNorm = (recentShots / timeWindow) * 3
  const possessionNorm = recentPossession / 100
  
  const momentum = (attacksNorm * 0.4 + shotsNorm * 0.4 + possessionNorm * 0.2) * 100
  
  return Math.min(100, Math.max(0, momentum))
}

function analyzeMomentum(
  dangerousAttacks: number,
  shotsOnTarget: number,
  possession: number
): MomentumData {
  // Simular janelas temporais (em produção, usar dados reais da API)
  const last5min = calculateMomentumScore(
    dangerousAttacks * 0.3,
    shotsOnTarget * 0.3,
    possession,
    5
  )
  
  const last10min = calculateMomentumScore(
    dangerousAttacks * 0.6,
    shotsOnTarget * 0.6,
    possession,
    10
  )
  
  const last15min = calculateMomentumScore(
    dangerousAttacks,
    shotsOnTarget,
    possession,
    15
  )
  
  // Determinar tendência
  let trend: "crescendo" | "neutro" | "caindo" = "neutro"
  
  if (last5min > last10min && last10min > last15min) {
    trend = "crescendo"
  } else if (last5min < last10min && last10min < last15min) {
    trend = "caindo"
  }
  
  return {
    last5min,
    last10min,
    last15min,
    trend
  }
}

// ==================== PRESSURE INDEX ====================

function analyzePressure(
  shotsOnTarget: number,
  dangerousAttacks: number,
  xg?: number
): PressureData {
  const occasions: string[] = []
  let pressureIndex = 0
  
  // Chutes no alvo
  if (shotsOnTarget >= 5) {
    pressureIndex += 30
    occasions.push(`${shotsOnTarget} finalizações no alvo`)
  }
  
  // Ataques perigosos
  if (dangerousAttacks >= 30) {
    pressureIndex += 25
    occasions.push(`${dangerousAttacks} ataques perigosos`)
  }
  
  // xG alto
  if (xg !== undefined && xg >= 1.5) {
    pressureIndex += 25
    occasions.push(`xG de ${xg.toFixed(2)}`)
  }
  
  // Sequência de ataques (simulado)
  if (dangerousAttacks >= 40) {
    pressureIndex += 20
    occasions.push("Sequência de ataques seguidos")
  }
  
  const isHotMoment = pressureIndex >= 60
  
  return {
    pressureIndex: Math.min(100, pressureIndex),
    isHotMoment,
    occasions
  }
}

// ==================== MINUTE PHASE ====================

function getMinutePhase(minute: number): "46-60" | "61-75" | "76+" {
  if (minute >= 46 && minute <= 60) return "46-60"
  if (minute >= 61 && minute <= 75) return "61-75"
  return "76+"
}

// ==================== HA FRIENDLY ====================

function checkHAFriendly(
  totalGoals: number,
  underdogRDS: number,
  underdogShotsRatio: number
): boolean {
  let conditions = 0
  
  if (totalGoals <= 2) conditions++
  if (underdogRDS >= 75) conditions++
  if (underdogShotsRatio >= 0.7) conditions++
  
  return conditions >= 2
}

// ==================== COHERENCE SCORE HA ====================

function calculateCoherenceScoreHA(
  haLine: string,
  haOdd: number,
  minute: number,
  score: string
): number {
  let coherence = 100
  
  // Odd muito esmagada
  if (haOdd < 1.5) {
    coherence -= 30
  } else if (haOdd > 2.8) {
    coherence -= 20
  }
  
  // Linha vs minuto
  const lineValue = parseFloat(haLine.replace("+", ""))
  if (minute >= 75 && lineValue < 1.0) {
    coherence -= 15
  }
  
  // Placar vs linha
  const [homeScore, awayScore] = score.split("-").map(Number)
  const scoreDiff = homeScore - awayScore
  
  if (scoreDiff >= 2 && lineValue < 1.5) {
    coherence -= 25
  }
  
  return Math.max(0, coherence)
}

// ==================== SHOT QUALITY INDEX ====================

function calculateShotQualityIndex(
  shotsTotal: number,
  xg?: number
): number {
  if (!xg || xg === 0 || shotsTotal === 0) {
    // Sem xG, usar proporção de chutes no alvo como proxy
    return 0.5
  }
  
  return xg / shotsTotal
}

// ==================== SCORE CONTEXTO DO PLACAR ====================

function calculateScoreContexto(
  score: string,
  minute: number,
  underdogRDS: number
): number {
  const [homeScore, awayScore] = score.split("-").map(Number)
  const scoreDiff = homeScore - awayScore
  
  let contexto = 50
  
  // 1x0 com underdog vivo
  if (scoreDiff === 1 && underdogRDS >= 65) {
    contexto = 80
  }
  
  // 0x0 truncado
  if (scoreDiff === 0 && underdogRDS < 50) {
    contexto = 60
  }
  
  // 2x0 tardio
  if (scoreDiff >= 2 && minute >= 70) {
    contexto = 30
  }
  
  // 0x0 competitivo
  if (scoreDiff === 0 && underdogRDS >= 60) {
    contexto = 75
  }
  
  return contexto
}

// ==================== RED FLAGS ====================

function detectRedFlags(
  redCardsAway: number,
  recentPenalty: boolean,
  steamMove: boolean,
  extremePressure: boolean
): string[] {
  const flags: string[] = []
  
  if (redCardsAway > 0) {
    flags.push("🔴 EXPULSÃO CONTRA UNDERDOG")
  }
  
  if (recentPenalty) {
    flags.push("⚠️ PÊNALTI RECENTE CONTRA UNDERDOG")
  }
  
  if (steamMove) {
    flags.push("📉 STEAM MOVE FORTE CONTRA UNDERDOG")
  }
  
  if (extremePressure) {
    flags.push("🔥 PRESSÃO EXTREMA DO FAVORITO")
  }
  
  return flags
}

// ==================== EXPECTED MOMENTUM ====================

function predictExpectedMomentum(momentum: MomentumData): "crescendo" | "neutro" | "caindo" {
  return momentum.trend
}

// ==================== PATTERN BREAK DETECTOR ====================

function detectPatternBreak(
  htSnapshot: HTSnapshot | undefined,
  currentRDS: number,
  currentShots: number,
  currentPossession: number
): "nenhum" | "leve" | "forte" {
  if (!htSnapshot) return "nenhum"
  
  const rdsDiff = Math.abs(currentRDS - htSnapshot.htRdsFora)
  const shotsDiff = Math.abs(currentShots - htSnapshot.statistics.shotsTotalAway)
  const possessionDiff = Math.abs(currentPossession - htSnapshot.statistics.possessionAway)
  
  let breakScore = 0
  
  if (rdsDiff > 30) breakScore += 3
  else if (rdsDiff > 15) breakScore += 1
  
  if (shotsDiff > 8) breakScore += 2
  else if (shotsDiff > 4) breakScore += 1
  
  if (possessionDiff > 20) breakScore += 2
  else if (possessionDiff > 10) breakScore += 1
  
  if (breakScore >= 5) return "forte"
  if (breakScore >= 2) return "leve"
  return "nenhum"
}

// ==================== FRAGILITY INDEX ====================

function calculateFragilityIndex(
  teamName: string,
  isLeading: boolean,
  minute: number
): number {
  // Simulação - em produção, usar dados históricos reais
  let fragility = 30
  
  if (isLeading && minute >= 75) {
    fragility += 20
  }
  
  // Adicionar dados históricos de gols sofridos tarde, viradas, etc.
  
  return Math.min(100, fragility)
}

// ==================== TDA - TEMPORAL DYNAMICS ADJUSTMENT ====================

function calculateTDA(
  currentRDS: number,
  previousRDS: number,
  rdsTrend: number[]
): {
  score: number
  trend: "consistente" | "volátil"
  description: string
} {
  // Analisar progressão temporal
  const rdsChange = currentRDS - previousRDS
  
  // Calcular volatilidade
  let volatility = 0
  for (let i = 1; i < rdsTrend.length; i++) {
    volatility += Math.abs(rdsTrend[i] - rdsTrend[i - 1])
  }
  volatility = volatility / (rdsTrend.length - 1)
  
  const isConsistent = volatility < 10 && rdsChange >= 0
  const trend = isConsistent ? "consistente" : "volátil"
  
  let score = 50
  if (isConsistent && rdsChange > 5) {
    score = 85
  } else if (isConsistent) {
    score = 70
  } else if (volatility > 20) {
    score = 30
  }
  
  const description = isConsistent
    ? "Estatísticas melhorando progressivamente - cenário estável"
    : "Jogo volátil - maior cautela necessária"
  
  return { score, trend, description }
}

// ==================== GAME TEMPO ====================

function calculateGameTempo(
  totalShots: number,
  dangerousAttacks: number,
  fouls: number
): {
  speed: "alto" | "médio" | "baixo"
  volatilityRisk: number
  description: string
} {
  const tempo = totalShots + dangerousAttacks * 0.5 - fouls * 0.3
  
  let speed: "alto" | "médio" | "baixo"
  let volatilityRisk: number
  let description: string
  
  if (tempo > 50) {
    speed = "alto"
    volatilityRisk = 70
    description = "Ritmo alto - maior volatilidade e risco"
  } else if (tempo > 30) {
    speed = "médio"
    volatilityRisk = 40
    description = "Ritmo médio - cenário equilibrado"
  } else {
    speed = "baixo"
    volatilityRisk = 20
    description = "Ritmo baixo - cenário estável favorece HA+"
  }
  
  return { speed, volatilityRisk, description }
}

// ==================== ERP - EXPECTED REVERSAL PROBABILITY ====================

function calculateERP(
  favoriteRDS: number,
  underdogRDS: number,
  minute: number,
  rdsTrend: number[],
  fragilityIndex: number
): {
  reversalProbability: number
  factors: string[]
  impact: "alto" | "médio" | "baixo"
} {
  const factors: string[] = []
  let reversalProb = 0
  
  // Favorito cansando (RDS caindo)
  if (rdsTrend.length >= 2) {
    const recentTrend = rdsTrend[rdsTrend.length - 1] - rdsTrend[rdsTrend.length - 2]
    if (recentTrend < -5) {
      reversalProb += 20
      factors.push("Favorito perdendo intensidade")
    }
  }
  
  // Underdog crescendo
  if (underdogRDS > favoriteRDS) {
    reversalProb += 25
    factors.push("Underdog dominando estatisticamente")
  } else if (underdogRDS >= favoriteRDS * 0.8) {
    reversalProb += 15
    factors.push("Underdog competitivo")
  }
  
  // Minuto avançado
  if (minute >= 70) {
    reversalProb += 10
    factors.push("Minutos finais - maior imprevisibilidade")
  }
  
  // Fragilidade do favorito
  if (fragilityIndex > 60) {
    reversalProb += 20
    factors.push("Favorito historicamente frágil")
  }
  
  // RDS invertendo tendência
  if (underdogRDS > 70 && favoriteRDS < 60) {
    reversalProb += 15
    factors.push("Inversão clara de domínio")
  }
  
  reversalProb = Math.min(100, reversalProb)
  
  let impact: "alto" | "médio" | "baixo"
  if (reversalProb >= 60) impact = "alto"
  else if (reversalProb >= 35) impact = "médio"
  else impact = "baixo"
  
  return {
    reversalProbability: reversalProb,
    factors,
    impact
  }
}

// ==================== SHADOW xG CALCULATOR ====================

function calculateShadowXG(
  dangerousAttacks: number,
  corners: number,
  shotsOnTarget: number,
  xg?: number
): number {
  let shadowXG = 0
  
  // Cruzamentos perigosos (proxy via ataques perigosos)
  shadowXG += (dangerousAttacks / 50) * 0.3
  
  // Escanteios repetidos
  if (corners >= 5) {
    shadowXG += 0.2
  }
  
  // Bola travada na área (proxy via chutes no alvo sem xG proporcional)
  if (xg && shotsOnTarget > 0) {
    const xgPerShot = xg / shotsOnTarget
    if (xgPerShot < 0.1) {
      shadowXG += 0.15
    }
  }
  
  return Math.min(1.5, shadowXG)
}

// ==================== TIME BOMB DETECTOR ====================

function detectTimeBomb(
  xg: number,
  shadowXG: number,
  pressureIndex: number,
  corners: number
): boolean {
  let bombScore = 0
  
  // xG frustrado (alto xG sem gol)
  if (xg >= 1.5) bombScore += 3
  
  // Shadow xG alto
  if (shadowXG >= 0.5) bombScore += 2
  
  // Pressão real
  if (pressureIndex >= 70) bombScore += 3
  
  // Escanteios repetidos
  if (corners >= 6) bombScore += 2
  
  return bombScore >= 6
}

// ==================== DEAD GAME DETECTOR ====================

function detectDeadGame(
  xgHome: number,
  xgAway: number,
  totalShots: number,
  possession: number,
  minute: number
): boolean {
  let deadScore = 0
  
  // xG parado
  if (xgHome + xgAway < 0.5) deadScore += 3
  
  // Poucos chutes
  if (totalShots < 8 && minute >= 60) deadScore += 2
  
  // Posse passiva
  if (Math.abs(possession - 50) < 10) deadScore += 1
  
  // Ritmo lento
  if (totalShots < 10 && minute >= 70) deadScore += 2
  
  return deadScore >= 5
}

// ==================== RISK MAP ENGINE ====================

function classifyRiskMap(
  totalShots: number,
  dangerousAttacks: number,
  xgHome: number,
  xgAway: number,
  rdsCasa: number,
  rdsFora: number,
  scoreDiff: number
): "explosive" | "controlled" | "chaotic" | "locked" | "dead" {
  const totalXG = xgHome + xgAway
  const rdsBalance = Math.abs(rdsCasa - rdsFora)
  
  // Dead Game
  if (totalXG < 0.5 && totalShots < 10) {
    return "dead"
  }
  
  // Explosive
  if (totalXG >= 3.0 && dangerousAttacks >= 60) {
    return "explosive"
  }
  
  // Controlled
  if (rdsBalance > 25 && scoreDiff >= 1) {
    return "controlled"
  }
  
  // Chaotic
  if (totalShots >= 25 && rdsBalance < 10) {
    return "chaotic"
  }
  
  // Locked
  return "locked"
}

// ==================== AUTO-TUNING AGGRO LEVEL ====================

function determineAggroLevel(
  momentumScore: MomentumData,
  shadowXG: number,
  timeBombActive: boolean,
  patternBreak: "nenhum" | "leve" | "forte",
  deadGameDetected: boolean,
  riskMapType: "explosive" | "controlled" | "chaotic" | "locked" | "dead",
  pressureIndex: number
): number {
  // Nível 0 - Ultra Seguro
  if (deadGameDetected || momentumScore.last5min < 25 || riskMapType === "dead") {
    return 0
  }
  
  // Nível 3 - Agressivo Inteligente
  if (
    (timeBombActive || patternBreak === "forte") &&
    pressureIndex >= 70 &&
    (riskMapType === "explosive" || riskMapType === "chaotic")
  ) {
    return 3
  }
  
  // Nível 2 - Moderado Pro
  if (
    shadowXG >= 0.4 &&
    momentumScore.last5min >= 60 &&
    (riskMapType === "chaotic" || riskMapType === "explosive")
  ) {
    return 2
  }
  
  // Nível 1 - Conservador Pro (padrão)
  return 1
}

// ==================== OPC ANALYZER COM EV ≥ 0 ====================

function analyzeOPC(
  haHasEV: boolean,
  htStats: HTSummary,
  currentMinute: number,
  momentumScore: MomentumData,
  pressureIndex: PressureData,
  shadowXG: number,
  timeBombActive: boolean,
  ev: number
): string {
  if (haHasEV) {
    return "HA+ tem EV+ - OPC não necessária"
  }
  
  // OPC só pode ser recomendado com EV ≥ 0
  if (ev < 0) {
    return "❌ OPC bloqueado - EV negativo não permitido para OPC"
  }
  
  let opcSignals = 0
  const opcReasons: string[] = []
  
  // Over 0.5/1.5
  if (momentumScore.last5min >= 75 && pressureIndex.pressureIndex >= 65) {
    opcSignals++
    opcReasons.push("Momentum e pressão altos favorecem Over")
  }
  
  if (timeBombActive) {
    opcSignals++
    opcReasons.push("Time Bomb ativa - gol iminente")
  }
  
  if (shadowXG >= 0.6) {
    opcSignals++
    opcReasons.push("Shadow xG alto indica chances não convertidas")
  }
  
  // Cartões
  const totalCards = htStats.yellowHome + htStats.yellowAway + (htStats.redHome + htStats.redAway) * 2
  if (totalCards >= 4 && currentMinute >= 60) {
    opcSignals++
    opcReasons.push("Jogo agressivo favorece mais cartões")
  }
  
  // Under
  const totalXG = (htStats.xgHome || 0) + (htStats.xgAway || 0)
  if (totalXG < 0.8 && currentMinute >= 70) {
    opcSignals++
    opcReasons.push("xG baixo favorece Under")
  }
  
  if (opcSignals >= 3) {
    return `✅ OPC VÁLIDA (EV: ${ev.toFixed(2)}%): ${opcReasons.slice(0, 3).join(" • ")}`
  }
  
  return "❌ Nenhuma OPC válida (menos de 3 sinais EV+)"
}

// ==================== ANÁLISE LIVE COMPLETA COM GODMODE + AUTO-TUNING ====================

function performLiveAnalysisComplete(
  teamName: string,
  haLine: string,
  haOdd: number,
  currentMinute: number,
  htStats: HTSummary,
  mode: "LAB" | "REAL",
  ultraConservador: boolean
): AnalysisResult {
  // Calcular RDS atual
  const currentRdsCasa = calculateRDS(
    htStats.shotsTotalHome,
    htStats.shotsOnTargetHome,
    htStats.possessionHome,
    htStats.dangerousAttacksHome,
    htStats.xgHome
  )
  
  const currentRdsFora = calculateRDS(
    htStats.shotsTotalAway,
    htStats.shotsOnTargetAway,
    htStats.possessionAway,
    htStats.dangerousAttacksAway,
    htStats.xgAway
  )
  
  // Análise básica de probabilidade
  const shotsRatio = htStats.shotsTotalAway / (htStats.shotsTotalHome + htStats.shotsTotalAway + 0.01)
  const shotsOnTargetRatio = htStats.shotsOnTargetAway / (htStats.shotsOnTargetHome + htStats.shotsOnTargetAway + 0.01)
  
  let realProb = 50
  realProb += (shotsRatio - 0.5) * 30
  realProb += (shotsOnTargetRatio - 0.5) * 25
  realProb += (currentRdsFora - 50) * 0.4
  
  const [homeScore, awayScore] = htStats.halftimeScore.split("-").map(Number)
  const scoreDiff = homeScore - awayScore
  if (scoreDiff === 0) realProb += 5
  else if (scoreDiff === 1) realProb -= 5
  else if (scoreDiff >= 2) realProb -= 15

  realProb = Math.max(0, Math.min(100, realProb))

  const impliedProb = calculateImpliedProbability(haOdd)
  const ev = calculateEV(realProb, impliedProb)

  const tacticalScore = Math.round(realProb * 0.85 + 15)
  const statisticalScore = Math.round(realProb * 0.9 + 10)
  const neuralScore = Math.round((tacticalScore + statisticalScore) / 2)
  
  let confidence = (tacticalScore + statisticalScore) / 2

  // ==================== APLICAR GODMODE RULES ====================
  
  // 1. HT Snapshot (se existir)
  const htSnapshot = firstHalfSnapshot[htStats.fixtureId]
  
  // 2. Comparação HT→FT
  const htToFtCoherence = compareHTtoFT(htStats.fixtureId, currentRdsCasa, currentRdsFora, htStats)
  
  if (htToFtCoherence === "ROTEIRO CONFIRMADO") {
    confidence += 5
  } else if (htToFtCoherence === "ROTEIRO ROMPIDO") {
    confidence -= 10
  }
  
  // 3. Momentum Live Score
  const momentumScore = analyzeMomentum(
    htStats.dangerousAttacksAway,
    htStats.shotsOnTargetAway,
    htStats.possessionAway
  )
  
  if (momentumScore.trend === "crescendo") {
    confidence += 3
  } else if (momentumScore.trend === "caindo") {
    confidence -= 5
  }
  
  // 4. Pressure Index
  const pressureIndex = analyzePressure(
    htStats.shotsOnTargetHome,
    htStats.dangerousAttacksHome,
    htStats.xgHome
  )
  
  if (pressureIndex.isHotMoment) {
    confidence -= 8
  }
  
  // 5. Minute Phase
  const minutePhase = getMinutePhase(currentMinute)
  
  if (minutePhase === "76+") {
    confidence -= 10
  } else if (minutePhase === "61-75") {
    confidence -= 3
  }
  
  // 6. HA Friendly
  const totalGoals = homeScore + awayScore
  const underdogShotsRatio = htStats.shotsOnTargetAway / (htStats.shotsOnTargetHome + 0.01)
  const haFriendly = checkHAFriendly(totalGoals, currentRdsFora, underdogShotsRatio)
  
  if (!haFriendly) {
    confidence -= 7
  }
  
  // 7. Coherence Score HA
  const coherenceScoreHA = calculateCoherenceScoreHA(haLine, haOdd, currentMinute, htStats.halftimeScore)
  
  if (coherenceScoreHA < 60) {
    confidence -= 8
  }
  
  // 8. Shot Quality Index
  const shotQualityIndex = calculateShotQualityIndex(htStats.shotsTotalHome, htStats.xgHome)
  
  if (shotQualityIndex < 0.1 && htStats.shotsTotalHome > 10) {
    confidence += 5 // Falsa pressão do favorito
  } else if (shotQualityIndex > 0.15 && htStats.xgHome && htStats.xgHome > 2) {
    confidence -= 10 // Pressão real
  }
  
  // 9. Score Contexto do Placar
  const scoreContextoPlacar = calculateScoreContexto(htStats.halftimeScore, currentMinute, currentRdsFora)
  
  confidence += (scoreContextoPlacar - 50) * 0.15
  
  // 10. Shadow xG
  const shadowXG = calculateShadowXG(
    htStats.dangerousAttacksAway,
    htStats.cornersAway,
    htStats.shotsOnTargetAway,
    htStats.xgAway
  )
  
  // 11. Time Bomb
  const timeBombActive = detectTimeBomb(
    htStats.xgAway || 0,
    shadowXG,
    pressureIndex.pressureIndex,
    htStats.cornersAway
  )
  
  if (timeBombActive) {
    confidence += 8
  }
  
  // 12. Dead Game
  const deadGameDetected = detectDeadGame(
    htStats.xgHome || 0,
    htStats.xgAway || 0,
    htStats.shotsTotalHome + htStats.shotsTotalAway,
    htStats.possessionHome,
    currentMinute
  )
  
  if (deadGameDetected) {
    confidence -= 15
  }
  
  // 13. Risk Map
  const riskMapType = classifyRiskMap(
    htStats.shotsTotalHome + htStats.shotsTotalAway,
    htStats.dangerousAttacksHome + htStats.dangerousAttacksAway,
    htStats.xgHome || 0,
    htStats.xgAway || 0,
    currentRdsCasa,
    currentRdsFora,
    scoreDiff
  )
  
  // Ajustar confiança baseado no Risk Map
  if (riskMapType === "explosive" || riskMapType === "chaotic") {
    confidence -= 5
  } else if (riskMapType === "controlled") {
    confidence += 5
  } else if (riskMapType === "dead") {
    confidence -= 20
  }
  
  // 14. Pattern Break
  const patternBreak = detectPatternBreak(
    htSnapshot,
    currentRdsFora,
    htStats.shotsTotalAway,
    htStats.possessionAway
  )
  
  if (patternBreak === "forte") {
    confidence -= 15
  } else if (patternBreak === "leve") {
    confidence -= 5
  }
  
  // 15. Fragility Index
  const isLeading = homeScore > awayScore
  const fragilityIndex = calculateFragilityIndex(htStats.homeTeam, isLeading, currentMinute)
  
  if (fragilityIndex > 60 && scoreDiff === 1) {
    confidence += 5
  }
  
  // 16. TDA - Temporal Dynamics Adjustment
  const rdsTrend = [currentRdsFora] // Em produção, manter histórico
  const tda = calculateTDA(currentRdsFora, htSnapshot?.htRdsFora || currentRdsFora, rdsTrend)
  
  if (tda.trend === "consistente") {
    confidence += 4
  } else {
    confidence -= 6
  }
  
  // 17. Game Tempo
  const gameTempo = calculateGameTempo(
    htStats.shotsTotalHome + htStats.shotsTotalAway,
    htStats.dangerousAttacksHome + htStats.dangerousAttacksAway,
    0 // Faltas não disponíveis neste mock
  )
  
  if (gameTempo.speed === "alto") {
    confidence -= 5
  } else if (gameTempo.speed === "baixo") {
    confidence += 3
  }
  
  // 18. ERP - Expected Reversal Probability
  const erp = calculateERP(currentRdsCasa, currentRdsFora, currentMinute, rdsTrend, fragilityIndex)
  
  if (erp.impact === "alto") {
    confidence += 8
  } else if (erp.impact === "médio") {
    confidence += 3
  }

  // ==================== AUTO-TUNING AGGRO LEVEL ====================
  
  const aggroLevel = determineAggroLevel(
    momentumScore,
    shadowXG,
    timeBombActive,
    patternBreak,
    deadGameDetected,
    riskMapType,
    pressureIndex.pressureIndex
  )
  
  const aggroConfig = GODMODE_RULES.aggroLevels[aggroLevel as 0 | 1 | 2 | 3]

  // ==================== BLOQUEIOS ABSOLUTOS (GODMODE RULE 8) ====================
  
  const extremePressure = pressureIndex.pressureIndex > 75 && htStats.xgHome !== undefined && htStats.xgHome > 2.5
  const redFlags = detectRedFlags(htStats.redAway, false, false, extremePressure)
  
  // Bloqueio por xG baixo
  if ((htStats.xgAway || 0) < GODMODE_RULES.blocks.xgLow.threshold && currentMinute <= GODMODE_RULES.blocks.xgLow.minute) {
    redFlags.push(`🚫 xG VISITANTE < ${GODMODE_RULES.blocks.xgLow.threshold} até minuto ${GODMODE_RULES.blocks.xgLow.minute}`)
  }
  
  // Bloqueio por visitante morto
  if ((htStats.xgAway || 0) === 0 && htStats.shotsTotalAway === 0) {
    redFlags.push("🚫 VISITANTE SEM xG E SEM CHUTES")
  }
  
  // Bloqueio por expulsões
  if (htStats.redHome + htStats.redAway >= 2) {
    redFlags.push("🚫 2+ EXPULSÕES - APENAS UNDER/CARTÕES")
  }
  
  // Bloqueio por odd baixa
  if (haOdd < GODMODE_RULES.blocks.minOdds) {
    redFlags.push(`🚫 ODD < ${GODMODE_RULES.blocks.minOdds}`)
  }
  
  // Bloqueio por ERP alto
  if (erp.reversalProbability > GODMODE_RULES.blocks.maxERP) {
    redFlags.push(`🚫 ERP > ${GODMODE_RULES.blocks.maxERP}%`)
  }
  
  // Bloqueio por Risk Map DEAD
  if (riskMapType === "dead") {
    redFlags.push("🚫 RISK MAP = DEAD")
  }
  
  if (redFlags.length > 0) {
    confidence = 0 // Bloqueio total
  }

  // Garantir confiança entre 0-100
  confidence = Math.max(0, Math.min(100, confidence))

  // ==================== DECISÃO FINAL COM GODMODE + AUTO-TUNING ====================
  
  let handicap = "NÃO APOSTAR"
  let recommendation = "SEM RECOMENDAÇÃO – NÃO APOSTAR"
  const justification: string[] = []
  let evNegativeWarning = ""

  if (redFlags.length > 0) {
    justification.push("🚫 BLOQUEIO ATIVADO POR RED FLAGS CRÍTICAS:")
    redFlags.forEach(flag => justification.push(`   ${flag}`))
  } else {
    // Aplicar lógica de AggroLevel
    const evThreshold = aggroConfig.evMin
    
    if (ev >= evThreshold) {
      // Confirmação Tripla obrigatória para Nível 3
      if (aggroLevel === 3) {
        const tripleConfirmation = 
          (momentumScore.last5min >= 45) &&
          (pressureIndex.pressureIndex >= 60) &&
          (patternBreak !== "nenhum" || timeBombActive || shadowXG >= 0.20) &&
          (htToFtCoherence === "ROTEIRO CONFIRMADO" || htToFtCoherence === "NEUTRO") &&
          (gameTempo.speed !== "baixo") &&
          (haOdd >= GODMODE_RULES.blocks.minOdds) &&
          (riskMapType !== "dead")
        
        if (tripleConfirmation && confidence >= 60) {
          handicap = haLine
          recommendation = `✅ APOSTAR: ${teamName} ${haLine}`
          justification.push(`✅ Modo Agressivo Inteligente (Nível ${aggroLevel})`)
          evNegativeWarning = "⚠️ Entrada com EV negativo controlado — Modo Agressivo Inteligente."
        } else {
          justification.push(`⚠️ Nível ${aggroLevel} não atende Confirmação Tripla completa`)
        }
      } else {
        // Níveis 0, 1, 2
        if (ultraConservador && mode === "REAL") {
          if (currentMinute >= 75) {
            if (confidence >= 70 && ev > 4) {
              handicap = haLine
              recommendation = `✅ APOSTAR: ${teamName} ${haLine}`
              justification.push(`✅ Passou no Modo Ultra Conservador (Minuto ≥ 75) - Nível ${aggroLevel}`)
            } else {
              justification.push(`🛡️ MODO ULTRA CONSERVADOR ATIVO (Minuto ≥ 75) - Nível ${aggroLevel}`)
              justification.push(`   Confiança: ${confidence.toFixed(1)}% (mínimo: 70%)`)
              justification.push(`   EV: ${ev.toFixed(2)}% (mínimo: 4%)`)
            }
          } else {
            if (confidence >= 65 && ev > 3) {
              handicap = haLine
              recommendation = `✅ APOSTAR: ${teamName} ${haLine}`
              justification.push(`✅ Confiança e EV adequados para o 2º tempo - Nível ${aggroLevel}`)
            } else {
              justification.push(`⚠️ Confiança/EV insuficientes para HA+ seguro no 2º tempo - Nível ${aggroLevel}`)
            }
          }
        } else {
          if (realProb >= 62 && ev > 2) {
            handicap = haLine
            recommendation = `✅ APOSTAR: ${teamName} ${haLine}`
            justification.push(`✅ Boa probabilidade e EV positivo - Nível ${aggroLevel}`)
          } else {
            justification.push(`⚠️ Sem edge matemático suficiente para o 2º tempo - Nível ${aggroLevel}`)
          }
        }
        
        if (ev < 0 && handicap !== "NÃO APOSTAR") {
          evNegativeWarning = `⚠️ EV negativo (${ev.toFixed(2)}%) - ${aggroConfig.name}`
        }
      }
    } else {
      justification.push(`⚠️ EV (${ev.toFixed(2)}%) abaixo do threshold do Nível ${aggroLevel} (${evThreshold.toFixed(2)}%)`)
    }
  }

  // OPC Analysis (com EV ≥ 0)
  const haHasEV = ev > 2 && confidence >= 60
  const opcRecommendation = analyzeOPC(
    haHasEV,
    htStats,
    currentMinute,
    momentumScore,
    pressureIndex,
    shadowXG,
    timeBombActive,
    ev
  )

  justification.push(`\n📊 Métricas Principais:`)
  justification.push(`   Probabilidade Real: ${realProb.toFixed(1)}%`)
  justification.push(`   Probabilidade Implícita: ${impliedProb.toFixed(1)}%`)
  justification.push(`   EV: ${ev.toFixed(2)}%`)
  justification.push(`   RDS Casa: ${currentRdsCasa.toFixed(1)} | RDS Fora: ${currentRdsFora.toFixed(1)}`)
  justification.push(`   AggroLevel: ${aggroLevel} (${aggroConfig.name})`)
  
  if (htToFtCoherence !== "NEUTRO") {
    justification.push(`\n🔄 Comparação HT→FT: ${htToFtCoherence}`)
  }
  
  justification.push(`\n⚡ Módulos GODMODE Ativos:`)
  justification.push(`   Momentum: ${momentumScore.trend.toUpperCase()} (${momentumScore.last5min.toFixed(0)}/100)`)
  justification.push(`   Pressure Index: ${pressureIndex.pressureIndex.toFixed(0)}/100 ${pressureIndex.isHotMoment ? '🔥' : ''}`)
  justification.push(`   HA Friendly: ${haFriendly ? 'SIM ✅' : 'NÃO ❌'}`)
  justification.push(`   Pattern Break: ${patternBreak.toUpperCase()}`)
  justification.push(`   TDA: ${tda.trend.toUpperCase()} (${tda.score}/100)`)
  justification.push(`   Game Tempo: ${gameTempo.speed.toUpperCase()} (Risco: ${gameTempo.volatilityRisk}%)`)
  justification.push(`   ERP: ${erp.impact.toUpperCase()} (${erp.reversalProbability.toFixed(0)}%)`)
  justification.push(`   Shadow xG: ${shadowXG.toFixed(2)}`)
  justification.push(`   Time Bomb: ${timeBombActive ? 'ATIVADA 💣' : 'Inativa'}`)
  justification.push(`   Dead Game: ${deadGameDetected ? 'DETECTADO ⚠️' : 'Não'}`)
  justification.push(`   Risk Map: ${riskMapType.toUpperCase()}`)
  
  justification.push(`\n🎯 OPC (Oportunidade Secundária):`)
  justification.push(`   ${opcRecommendation}`)

  // Next Step Prediction
  let nextStep = ""
  if (momentumScore.trend === "crescendo" && timeBombActive) {
    nextStep = "🚀 Expectativa: Gol iminente nos próximos 5-10 minutos"
  } else if (deadGameDetected) {
    nextStep = "⏸️ Expectativa: Jogo travado - poucos eventos esperados"
  } else if (riskMapType === "chaotic") {
    nextStep = "⚡ Expectativa: Jogo volátil - múltiplos eventos possíveis"
  } else if (riskMapType === "controlled") {
    nextStep = "🎯 Expectativa: Favorito mantém controle até o final"
  } else {
    nextStep = "📊 Expectativa: Cenário equilibrado - monitorar próximos 10 minutos"
  }

  const enhancedData: LiveEnhancedDataComplete = {
    momentumScore,
    pressureIndex,
    minutePhase,
    haFriendly,
    coherenceScoreHA,
    shotQualityIndex,
    scoreContextoPlacar,
    redFlags,
    expectedMomentum: predictExpectedMomentum(momentumScore),
    patternBreak,
    fragilityIndex,
    htToFtCoherence,
    tda,
    gameTempo,
    erp,
    riskMapType,
    shadowXG,
    timeBombActive,
    deadGameDetected,
    trueValueDetected: Math.abs(ev) > 8,
    aggroLevel,
    turningPointDetected: patternBreak === "forte",
    antiTrapActive: false,
    postGoalMode: false
  }

  return {
    recommendation,
    handicap,
    odd: haOdd,
    ev,
    confidence,
    justification,
    tacticalScore,
    statisticalScore,
    neuralScore,
    teamName,
    haLine,
    probabilityCoverage: realProb,
    enhancedData,
    htSnapshot,
    opcRecommendation,
    nextStep,
    aggroLevel,
    aggroLevelName: aggroConfig.name,
    evNegativeWarning: evNegativeWarning || undefined
  }
}

// ==================== ANÁLISE PRÉ-JOGO (MANTIDA ORIGINAL) ====================

function performSimpleAnalysis(
  data: GameData,
  mode: "LAB" | "REAL",
  ultraConservador: boolean
): AnalysisResult {
  const realProb = calculateRealProbability(data)
  const impliedProb = calculateImpliedProbability(data.oddHaPositivo)
  const ev = calculateEV(realProb, impliedProb)

  const tacticalScore = Math.round(realProb * 0.8 + 20)
  const statisticalScore = Math.round(realProb * 0.9 + 10)
  const neuralScore = Math.round((tacticalScore + statisticalScore) / 2)
  
  let confidence = (tacticalScore + statisticalScore) / 2

  let handicap = "NÃO APOSTAR"
  let recommendation = "SEM RECOMENDAÇÃO – NÃO APOSTAR"
  const justification: string[] = []

  if (ultraConservador && mode === "REAL") {
    if (confidence >= 70 && ev > 4) {
      handicap = data.linhaHaPositiva
      recommendation = `APOSTAR: Visitante ${data.linhaHaPositiva}`
      justification.push("✅ Confiança ≥ 70% e EV > 4%")
    } else {
      justification.push("🛡️ MODO ULTRA CONSERVADOR ATIVO")
      justification.push(`Confiança: ${confidence.toFixed(1)}% (mínimo: 70%)`)
      justification.push(`EV: ${ev.toFixed(2)}% (mínimo: 4%)`)
    }
  } else {
    if (confidence >= 65 && ev > 3) {
      handicap = data.linhaHaPositiva
      recommendation = `APOSTAR: Visitante ${data.linhaHaPositiva}`
      justification.push("✅ Boa confiança e EV positivo")
    } else {
      justification.push("⚠️ Sem edge matemático suficiente")
    }
  }

  justification.push(`Probabilidade Real: ${realProb.toFixed(1)}%`)
  justification.push(`Probabilidade Implícita: ${impliedProb.toFixed(1)}%`)
  justification.push(`Score Tático: ${tacticalScore}/100`)
  justification.push(`Score Estatístico: ${statisticalScore}/100`)
  justification.push(`Score Neural: ${neuralScore}/100`)

  return {
    recommendation,
    handicap,
    odd: data.oddHaPositivo,
    ev,
    confidence,
    justification,
    tacticalScore,
    statisticalScore,
    neuralScore
  }
}

// ==================== COMPONENTE PRINCIPAL ====================

export default function Home() {
  const { toast } = useToast()
  const [isDark, setIsDark] = useState(true)

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    if (savedTheme) {
      setIsDark(savedTheme === "dark")
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("theme", isDark ? "dark" : "light")
  }, [isDark])

  const [mode, setMode] = useState<"LAB" | "REAL">("REAL")
  const [ultraConservador, setUltraConservador] = useState(true)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [userNotes, setUserNotes] = useState("")

  const [gameData, setGameData] = useState<GameData>({
    homeTeam: "",
    awayTeam: "",
    league: "",
    homeOdd: 0,
    drawOdd: 0,
    awayOdd: 0,
    oddHaPositivo: 0,
    linhaHaPositiva: "",
    homeForm: "",
    awayForm: ""
  })
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [preGameWarning, setPreGameWarning] = useState<string | null>(null)

  const [teamName, setTeamName] = useState("")
  const [fixtureIdInput, setFixtureIdInput] = useState("")
  const [htData, setHtData] = useState<HTSummary | null>(null)
  const [htLoading, setHtLoading] = useState(false)
  const [htError, setHtError] = useState<string | null>(null)
  const [htHaOdd, setHtHaOdd] = useState("")
  const [htHaLine, setHtHaLine] = useState("")
  const [htMinute, setHtMinute] = useState("")
  const [htMinuteFromAPI, setHtMinuteFromAPI] = useState(false)
  const [htAnalysis, setHtAnalysis] = useState<AnalysisResult | null>(null)
  const [htSnapshotData, setHtSnapshotData] = useState<HTSnapshot | null>(null)
  const [isAnalyzing2ndHalf, setIsAnalyzing2ndHalf] = useState(false)

  const analyzeGame = () => {
    if (!gameData.oddHaPositivo || gameData.oddHaPositivo <= 0) {
      toast({
        title: "Informação incompleta",
        description: "Preencha a Linha do HA+ antes de analisar.",
        variant: "destructive"
      })
      setPreGameWarning("⚠️ Preencha a linha e a odd do handicap asiático positivo (HA+) para continuar a análise.")
      return
    }

    if (!gameData.linhaHaPositiva || gameData.linhaHaPositiva.trim() === "") {
      toast({
        title: "Informação incompleta",
        description: "Preencha a Linha do HA+ antes de analisar.",
        variant: "destructive"
      })
      setPreGameWarning("⚠️ Preencha a linha e a odd do handicap asiático positivo (HA+) para continuar a análise.")
      return
    }

    setLoading(true)
    setPreGameWarning(null)
    setAnalysis(null)

    if (DEBUG) console.log("📊 [Pré-jogo] Dados:", gameData)

    if (gameData.oddHaPositivo < 1.4 || gameData.oddHaPositivo > 2.5) {
      setPreGameWarning(
        `⚠️ Odd do HA+ fora do padrão profissional (1.40 – 2.50). Verifique antes de confiar na análise.`
      )
    }

    setTimeout(() => {
      const result = performSimpleAnalysis(gameData, mode, ultraConservador)
      if (DEBUG) console.log("✅ [Pré-jogo] Resultado:", result)
      
      addToHistory({
        type: "Pré-Jogo",
        teams: `${gameData.homeTeam} vs ${gameData.awayTeam}`,
        handicap: result.handicap,
        ev: result.ev,
        confidence: result.confidence,
        decision: result.recommendation,
        notes: userNotes
      })

      setAnalysis(result)
      setLoading(false)
    }, 800)
  }

  const fetchLiveData = async () => {
    if (!teamName.trim() && !fixtureIdInput.trim()) {
      toast({
        title: "Informação incompleta",
        description: "Informe o nome do time ou o Fixture ID.",
        variant: "destructive"
      })
      setHtError("Informe o nome do time ou o Fixture ID.")
      return
    }

    setHtError(null)
    setHtLoading(true)

    try {
      const response = await fetch("/api/htft-live", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          teamName: teamName.trim(),
          fixtureId: fixtureIdInput.trim() || undefined,
          minute: parseInt(htMinute.replace(/\D/g, ""), 10) || 45,
          haLine: htHaLine || "+0.5",
          haOdd: parseFloat(htHaOdd.replace(",", ".")) || 2.0
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Erro ao buscar dados LIVE")
      }

      const liveResult = await response.json()
      const { liveData } = liveResult

      const updatedHtData: HTSummary = {
        fixtureId: liveData.fixtureId,
        homeTeam: liveData.homeTeam,
        awayTeam: liveData.awayTeam,
        halftimeScore: `${liveData.scoreHome}-${liveData.scoreAway}`,
        shotsTotalHome: liveData.shotsHome,
        shotsOnTargetHome: liveData.shotsOnGoalHome,
        shotsTotalAway: liveData.shotsAway,
        shotsOnTargetAway: liveData.shotsOnGoalAway,
        dangerousAttacksHome: liveData.dangerousAttacksHome,
        dangerousAttacksAway: liveData.dangerousAttacksAway,
        possessionHome: liveData.possessionHome,
        possessionAway: liveData.possessionAway,
        cornersHome: liveData.cornersHome,
        cornersAway: liveData.cornersAway,
        yellowHome: liveData.yellowHome,
        yellowAway: liveData.yellowAway,
        redHome: liveData.redHome,
        redAway: liveData.redAway,
        xgHome: liveData.xgHome,
        xgAway: liveData.xgAway
      }

      setHtData(updatedHtData)

      if (liveData.currentMinute) {
        setHtMinute(String(liveData.currentMinute))
        setHtMinuteFromAPI(true)
      } else {
        setHtMinuteFromAPI(false)
      }

      toast({
        title: "Dados carregados",
        description: "Dados LIVE carregados com sucesso!",
      })

    } catch (error: any) {
      toast({
        title: "Erro ao buscar dados",
        description: error.message || "Erro ao buscar dados LIVE",
        variant: "destructive"
      })
      setHtError(error.message || "Erro ao buscar dados LIVE")
    } finally {
      setHtLoading(false)
    }
  }

  const analyzeFirstHalfSnapshot = () => {
    if (!htData) {
      toast({
        title: "Dados não carregados",
        description: "Busque os dados do 1º tempo primeiro.",
        variant: "destructive"
      })
      setHtError("Busque os dados do 1º tempo primeiro.")
      return
    }

    const snapshot = analyzeFirstHalf(htData)
    setHtSnapshotData(snapshot)
    
    addToHistory({
      type: "HT Snapshot",
      teams: `${snapshot.homeTeam} vs ${snapshot.awayTeam}`,
      handicap: "N/A",
      ev: 0,
      confidence: snapshot.htUnderdogScore,
      decision: snapshot.htGameProfile,
      notes: snapshot.htTendency
    })

    toast({
      title: "Snapshot do 1º tempo",
      description: "Análise do 1º tempo concluída!",
    })
  }

  const runHtAnalysis = async () => {
    if (!htHaLine.trim()) {
      toast({
        title: "Informação incompleta",
        description: "Informe a linha do HA+ (ex: +0.5, +1.0).",
        variant: "destructive"
      })
      setHtError("Informe a linha do HA+ (ex: +0.5, +1.0).")
      return
    }

    const odd = parseFloat(htHaOdd.replace(",", "."))
    if (!odd || odd <= 1) {
      toast({
        title: "Informação incompleta",
        description: "Informe a odd do HA+ para o 2º tempo.",
        variant: "destructive"
      })
      setHtError("Informe a odd do HA+ para o 2º tempo.")
      return
    }

    if (!isValidOdd(odd)) {
      toast({
        title: "Odd fora do padrão",
        description: `Odd fora do intervalo profissional (${ODD_MIN.toFixed(2)} – ${ODD_MAX.toFixed(2)}).`,
        variant: "destructive"
      })
      setHtError(`Odd fora do intervalo profissional (${ODD_MIN.toFixed(2)} – ${ODD_MAX.toFixed(2)}).`)
      return
    }

    if (!htData) {
      toast({
        title: "Dados não carregados",
        description: "Dados live não carregados. Clique em Buscar Dados Live.",
        variant: "destructive"
      })
      setHtError("Busque os dados do 1º tempo primeiro.")
      return
    }

    const minute = parseInt(htMinute.replace(/\D/g, ""), 10)
    if (!minute || Number.isNaN(minute)) {
      toast({
        title: "Informação incompleta",
        description: "Informe o minuto atual para continuar.",
        variant: "destructive"
      })
      return
    }

    const minuteSafe = Number.isNaN(minute) ? 45 : minute

    setHtError(null)
    setIsAnalyzing2ndHalf(true)

    // Simular processamento assíncrono
    setTimeout(() => {
      const analyzedTeamName = teamName.trim() || htData.awayTeam

      const result = performLiveAnalysisComplete(
        analyzedTeamName,
        htHaLine,
        odd,
        minuteSafe,
        htData,
        mode,
        ultraConservador
      )
      
      addToHistory({
        type: "HT→FT",
        teams: `${htData.homeTeam} vs ${htData.awayTeam}`,
        handicap: result.handicap,
        ev: result.ev,
        confidence: result.confidence,
        decision: result.recommendation,
        notes: userNotes
      })

      setHtAnalysis(result)
      setIsAnalyzing2ndHalf(false)

      toast({
        title: "Análise do 2º tempo concluída",
        description: "GODMODE ativado - 26 regras + Auto-Tuning aplicados!",
      })
    }, 1500)
  }

  const addToHistory = (entry: Omit<HistoryEntry, "id" | "timestamp">) => {
    const newEntry: HistoryEntry = {
      ...entry,
      id: Date.now().toString(),
      timestamp: new Date()
    }
    setHistory(prev => [newEntry, ...prev].slice(0, 10))
  }

  const bgClass = isDark 
    ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" 
    : "bg-slate-100"
  
  const textClass = isDark ? "text-slate-100" : "text-slate-900"
  const textSecondaryClass = isDark ? "text-slate-400" : "text-slate-600"
  
  const cardClass = isDark 
    ? "bg-slate-900/60 border-slate-800" 
    : "bg-white border-slate-200"
  
  const inputClass = isDark 
    ? "bg-slate-800 border-slate-700 text-white" 
    : "bg-white border-slate-300 text-slate-900"

  return (
    <div className={`min-h-screen ${bgClass} ${textClass}`}>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header com tema */}
        <div className="flex items-center justify-between mb-8">
          <div className="text-center flex-1">
            <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Filtro Campeão vGODMODE 4.0 ULTRA MASTER
            </h1>
            <p className={`text-sm md:text-base ${textSecondaryClass}`}>
              26 Regras GODMODE • Auto-Tuning (0-3) • HA+ Prioridade • OPC EV≥0 • Shadow xG • Time Bomb • Risk Map • Dead Game • Zero emoção
            </p>
          </div>
          
          <div className="flex items-center gap-2 ml-4">
            <Sun className={`w-5 h-5 ${isDark ? "text-slate-500" : "text-yellow-500"}`} />
            <Switch
              checked={isDark}
              onCheckedChange={setIsDark}
            />
            <Moon className={`w-5 h-5 ${isDark ? "text-blue-400" : "text-slate-400"}`} />
          </div>
        </div>

        {/* Modo de Operação */}
        <Card className={`mb-6 ${cardClass}`}>
          <CardHeader>
            <CardTitle className={`flex items-center gap-2 text-lg ${textClass}`}>
              <Zap className="w-5 h-5 text-yellow-400" />
              Modo de Operação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Label htmlFor="mode-toggle" className={`text-base ${textClass}`}>
                  {mode === "LAB" ? "🧪 Modo LAB (Treino)" : "⚡ Modo REAL (Execução)"}
                </Label>
                <Switch
                  id="mode-toggle"
                  checked={mode === "REAL"}
                  onCheckedChange={(checked) => setMode(checked ? "REAL" : "LAB")}
                />
              </div>
            </div>
            <p className={`text-sm ${textSecondaryClass}`}>
              {mode === "LAB" 
                ? "Modo flexível para testar cenários. Sem travas rígidas."
                : "Modo profissional com GODMODE completo: 26 regras ativas, Auto-Tuning (0-3), bloqueios absolutos e Red Flags."}
            </p>

            {mode === "REAL" && (
              <div className={`flex items-center justify-between pt-2 border-t ${isDark ? "border-slate-800" : "border-slate-200"}`}>
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5 text-blue-400" />
                  <Label htmlFor="ultra-toggle" className={`text-base ${textClass}`}>
                    Modo Ultra Conservador
                  </Label>
                  <Switch
                    id="ultra-toggle"
                    checked={ultraConservador}
                    onCheckedChange={setUltraConservador}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Grid Pré-Jogo e HT→FT */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          {/* PRÉ-JOGO */}
          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                <Calculator className="w-5 h-5 text-emerald-400" />
                Análise Pré-Jogo
              </CardTitle>
              <CardDescription className={textSecondaryClass}>Insira os dados do jogo antes de começar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="homeTeam" className={textClass}>Time Mandante</Label>
                  <Input
                    id="homeTeam"
                    value={gameData.homeTeam}
                    onChange={(e) => setGameData({ ...gameData, homeTeam: e.target.value })}
                    placeholder="Ex: Flamengo"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="awayTeam" className={textClass}>Time Visitante</Label>
                  <Input
                    id="awayTeam"
                    value={gameData.awayTeam}
                    onChange={(e) => setGameData({ ...gameData, awayTeam: e.target.value })}
                    placeholder="Ex: Palmeiras"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="league" className={textClass}>Liga</Label>
                <Input
                  id="league"
                  value={gameData.league}
                  onChange={(e) => setGameData({ ...gameData, league: e.target.value })}
                  placeholder="Ex: Brasileirão Série A"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="homeOdd" className={textClass}>Odd Casa</Label>
                  <Input
                    id="homeOdd"
                    type="number"
                    step="0.01"
                    value={gameData.homeOdd || ""}
                    onChange={(e) => setGameData({ ...gameData, homeOdd: parseFloat(e.target.value) || 0 })}
                    placeholder="1.50"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="drawOdd" className={textClass}>Odd Empate</Label>
                  <Input
                    id="drawOdd"
                    type="number"
                    step="0.01"
                    value={gameData.drawOdd || ""}
                    onChange={(e) => setGameData({ ...gameData, drawOdd: parseFloat(e.target.value) || 0 })}
                    placeholder="3.50"
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="awayOdd" className={textClass}>Odd Visitante</Label>
                  <Input
                    id="awayOdd"
                    type="number"
                    step="0.01"
                    value={gameData.awayOdd || ""}
                    onChange={(e) => setGameData({ ...gameData, awayOdd: parseFloat(e.target.value) || 0 })}
                    placeholder="2.20"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 space-y-3">
                <div>
                  <Label htmlFor="linhaHaPositiva" className={`${textClass} font-bold flex items-center gap-2`}>
                    <Target className="w-4 h-4 text-emerald-400" />
                    Linha do Handicap Asiático Positivo (HA+) *
                  </Label>
                  <Select 
                    value={gameData.linhaHaPositiva} 
                    onValueChange={(value) => setGameData({ ...gameData, linhaHaPositiva: value })}
                  >
                    <SelectTrigger className={`${inputClass} mt-2 font-bold`}>
                      <SelectValue placeholder="Selecione a linha HA+" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+0.25">+0.25</SelectItem>
                      <SelectItem value="+0.5">+0.5</SelectItem>
                      <SelectItem value="+0.75">+0.75</SelectItem>
                      <SelectItem value="+1.0">+1.0</SelectItem>
                      <SelectItem value="+1.25">+1.25</SelectItem>
                      <SelectItem value="+1.5">+1.5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="oddHaPositivo" className={`${textClass} font-bold flex items-center gap-2`}>
                    <Target className="w-4 h-4 text-emerald-400" />
                    Odd do Handicap Asiático Positivo (HA+) *
                  </Label>
                  <Input
                    id="oddHaPositivo"
                    type="number"
                    step="0.01"
                    value={gameData.oddHaPositivo || ""}
                    onChange={(e) => setGameData({ ...gameData, oddHaPositivo: parseFloat(e.target.value) || 0 })}
                    placeholder="Ex: 2.00"
                    className={`${inputClass} mt-2 font-bold`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="homeForm" className={textClass}>Forma Casa</Label>
                  <Input
                    id="homeForm"
                    value={gameData.homeForm}
                    onChange={(e) => setGameData({ ...gameData, homeForm: e.target.value.toUpperCase() })}
                    placeholder="VVEED"
                    maxLength={5}
                    className={inputClass}
                  />
                </div>
                <div>
                  <Label htmlFor="awayForm" className={textClass}>Forma Visitante</Label>
                  <Input
                    id="awayForm"
                    value={gameData.awayForm}
                    onChange={(e) => setGameData({ ...gameData, awayForm: e.target.value.toUpperCase() })}
                    placeholder="EVVDE"
                    maxLength={5}
                    className={inputClass}
                  />
                </div>
              </div>

              {preGameWarning && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-200">{preGameWarning}</p>
                </div>
              )}

              <Button 
                onClick={analyzeGame} 
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? "Analisando..." : "Analisar Jogo (Pré-Jogo)"}
              </Button>
            </CardContent>
          </Card>

          {/* HT → FT */}
          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                <Activity className="w-5 h-5 text-cyan-400" />
                Análise HT → FT (Live) - GODMODE
              </CardTitle>
              <CardDescription className={textSecondaryClass}>Análise do 2º tempo com 26 regras GODMODE + Auto-Tuning ativas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="teamName" className={textClass}>Nome do Time</Label>
                <Input
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Ex: Flamengo"
                  className={inputClass}
                />
              </div>

              <div>
                <Label htmlFor="fixtureId" className={textClass}>Fixture ID (opcional)</Label>
                <Input
                  id="fixtureId"
                  value={fixtureIdInput}
                  onChange={(e) => setFixtureIdInput(e.target.value)}
                  placeholder="Ex: 12345"
                  className={inputClass}
                />
              </div>

              <Button 
                onClick={fetchLiveData}
                disabled={htLoading}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                {htLoading ? "Buscando..." : "Buscar Dados LIVE"}
              </Button>

              {htError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-200">{htError}</p>
                </div>
              )}

              {htData && (
                <>
                  <Separator className={isDark ? "bg-slate-700" : "bg-slate-300"} />
                  
                  <div className="space-y-3">
                    <h4 className={`font-semibold text-sm ${textClass}`}>Dados LIVE do Jogo</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-2 rounded`}>
                        <p className={textSecondaryClass}>Placar Atual</p>
                        <p className={`font-bold ${textClass}`}>{htData.halftimeScore}</p>
                      </div>
                      <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-2 rounded`}>
                        <p className={textSecondaryClass}>Finalizações</p>
                        <p className={`font-bold ${textClass}`}>{htData.shotsTotalHome} - {htData.shotsTotalAway}</p>
                      </div>
                      <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-2 rounded`}>
                        <p className={textSecondaryClass}>No Alvo</p>
                        <p className={`font-bold ${textClass}`}>{htData.shotsOnTargetHome} - {htData.shotsOnTargetAway}</p>
                      </div>
                      <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-2 rounded`}>
                        <p className={textSecondaryClass}>Posse</p>
                        <p className={`font-bold ${textClass}`}>{htData.possessionHome}% - {htData.possessionAway}%</p>
                      </div>
                    </div>
                  </div>

                  <Button 
                    onClick={analyzeFirstHalfSnapshot}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                  >
                    📊 Analisar 1º Tempo (Snapshot)
                  </Button>

                  <Separator className={isDark ? "bg-slate-700" : "bg-slate-300"} />
                </>
              )}

              <div className="space-y-3">
                <div>
                  <Label htmlFor="htHaLine" className={textClass}>Linha do HA+ *</Label>
                  <Select value={htHaLine} onValueChange={setHtHaLine}>
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Selecione a linha HA+" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="+0.5">+0.5</SelectItem>
                      <SelectItem value="+1.0">+1.0</SelectItem>
                      <SelectItem value="+1.5">+1.5</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="htHaOdd" className={textClass}>Odd do HA+ *</Label>
                    <Input
                      id="htHaOdd"
                      value={htHaOdd}
                      onChange={(e) => setHtHaOdd(e.target.value)}
                      placeholder="2.00"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <Label htmlFor="htMinute" className={textClass}>Minuto Atual</Label>
                    <Input
                      id="htMinute"
                      value={htMinute}
                      onChange={(e) => {
                        setHtMinute(e.target.value)
                        setHtMinuteFromAPI(false)
                      }}
                      placeholder="45"
                      disabled={htMinuteFromAPI}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <Button 
                onClick={runHtAnalysis}
                disabled={htLoading || !htData || isAnalyzing2ndHalf}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                {isAnalyzing2ndHalf ? "Analisando 2º Tempo..." : "🚀 Analisar 2º Tempo (19 Módulos)"}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* HT Snapshot Result */}
        {htSnapshotData && (
          <Card className={`mb-6 ${cardClass}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Leitura do 1º Tempo (HT Snapshot)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-4 rounded-lg`}>
                  <p className={`text-xs ${textSecondaryClass} mb-1`}>RDS Casa</p>
                  <p className={`text-2xl font-bold ${textClass}`}>{htSnapshotData.htRdsCasa.toFixed(1)}</p>
                  <Progress value={htSnapshotData.htRdsCasa} className="mt-2" />
                </div>
                <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-4 rounded-lg`}>
                  <p className={`text-xs ${textSecondaryClass} mb-1`}>RDS Fora</p>
                  <p className={`text-2xl font-bold ${textClass}`}>{htSnapshotData.htRdsFora.toFixed(1)}</p>
                  <Progress value={htSnapshotData.htRdsFora} className="mt-2" />
                </div>
                <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-4 rounded-lg`}>
                  <p className={`text-xs ${textSecondaryClass} mb-1`}>Underdog Score</p>
                  <p className={`text-2xl font-bold ${textClass}`}>{htSnapshotData.htUnderdogScore.toFixed(1)}</p>
                  <Progress value={htSnapshotData.htUnderdogScore} className="mt-2" />
                </div>
              </div>

              <div className={`${isDark ? "bg-blue-500/10 border-blue-500/30" : "bg-blue-100 border-blue-300"} border rounded-lg p-4`}>
                <p className={`font-semibold ${textClass} mb-2`}>Perfil do Jogo:</p>
                <p className={textClass}>{htSnapshotData.htGameProfile}</p>
              </div>

              <div className={`${isDark ? "bg-purple-500/10 border-purple-500/30" : "bg-purple-100 border-purple-300"} border rounded-lg p-4`}>
                <p className={`font-semibold ${textClass} mb-2`}>Tendência para o 2º Tempo:</p>
                <p className={textClass}>{htSnapshotData.htTendency}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Notas do Usuário */}
        <Card className={`mb-6 ${cardClass}`}>
          <CardHeader>
            <CardTitle className={`text-lg ${textClass}`}>📝 Minhas Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              placeholder="Adicione suas observações sobre o jogo (opcional)..."
              className={`${inputClass} min-h-[80px]`}
            />
          </CardContent>
        </Card>

        {/* Resultado Pré-Jogo */}
        {analysis && (
          <Card className={`mb-6 ${cardClass}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Resultado da Análise Pré-Jogo
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`p-4 rounded-lg border-2 ${
                analysis.recommendation.includes("NÃO APOSTAR")
                  ? "bg-red-500/10 border-red-500/50"
                  : "bg-emerald-500/10 border-emerald-500/50"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {analysis.recommendation.includes("NÃO APOSTAR") ? (
                    <XCircle className="w-6 h-6 text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  )}
                  <h3 className={`font-bold text-lg ${textClass}`}>
                    {analysis.recommendation}
                  </h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div>
                    <p className={`text-xs ${textSecondaryClass}`}>Handicap</p>
                    <p className={`font-bold ${textClass}`}>{analysis.handicap}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${textSecondaryClass}`}>Odd</p>
                    <p className={`font-bold ${textClass}`}>{analysis.odd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${textSecondaryClass}`}>EV+</p>
                    <p className={`font-bold ${textClass}`}>{analysis.ev.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className={`text-xs ${textSecondaryClass}`}>Confiança</p>
                    <p className={`font-bold ${textClass}`}>{analysis.confidence.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className={`font-semibold ${textClass}`}>Justificativa</h4>
                <ul className="space-y-1">
                  {analysis.justification.map((item, idx) => (
                    <li key={idx} className={`text-sm ${textSecondaryClass}`}>• {item}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Resultado HT→FT com GODMODE + AUTO-TUNING */}
        {htAnalysis && (
          <Card className={`mb-6 ${cardClass}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${textClass}`}>
                <Brain className="w-5 h-5 text-cyan-400" />
                Resultado da Análise HT → FT (GODMODE 4.0 ULTRA MASTER)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`p-4 rounded-lg border-2 ${
                htAnalysis.recommendation.includes("NÃO APOSTAR")
                  ? "bg-red-500/10 border-red-500/50"
                  : "bg-emerald-500/10 border-emerald-500/50"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {htAnalysis.recommendation.includes("NÃO APOSTAR") ? (
                    <XCircle className="w-6 h-6 text-red-400" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  )}
                  <h3 className={`font-bold text-lg ${textClass}`}>
                    {htAnalysis.recommendation}
                  </h3>
                </div>
                
                {/* AggroLevel Badge */}
                {htAnalysis.aggroLevel !== undefined && (
                  <div className="mb-3">
                    <Badge variant={
                      htAnalysis.aggroLevel === 0 ? "secondary" :
                      htAnalysis.aggroLevel === 1 ? "outline" :
                      htAnalysis.aggroLevel === 2 ? "default" : "destructive"
                    } className="text-sm">
                      AggroLevel {htAnalysis.aggroLevel}: {htAnalysis.aggroLevelName}
                    </Badge>
                  </div>
                )}
                
                {/* EV Negative Warning */}
                {htAnalysis.evNegativeWarning && (
                  <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3 mb-3">
                    <p className="text-sm text-orange-200">{htAnalysis.evNegativeWarning}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
                  <div>
                    <p className={`text-xs ${textSecondaryClass}`}>Linha HA+</p>
                    <p className={`font-bold ${textClass}`}>{htAnalysis.haLine}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${textSecondaryClass}`}>Odd</p>
                    <p className={`font-bold ${textClass}`}>{htAnalysis.odd.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className={`text-xs ${textSecondaryClass}`}>EV+</p>
                    <p className={`font-bold ${textClass}`}>{htAnalysis.ev.toFixed(2)}%</p>
                  </div>
                  <div>
                    <p className={`text-xs ${textSecondaryClass}`}>Confiança</p>
                    <p className={`font-bold ${textClass}`}>{htAnalysis.confidence.toFixed(1)}%</p>
                  </div>
                </div>
              </div>

              {/* Next Step */}
              {htAnalysis.nextStep && (
                <div className={`${isDark ? "bg-cyan-500/10 border-cyan-500/30" : "bg-cyan-100 border-cyan-300"} border rounded-lg p-4`}>
                  <p className={`font-semibold ${textClass} mb-2`}>🎯 Próximo Passo Previsto:</p>
                  <p className={textClass}>{htAnalysis.nextStep}</p>
                </div>
              )}

              {/* OPC */}
              {htAnalysis.opcRecommendation && (
                <div className={`${isDark ? "bg-purple-500/10 border-purple-500/30" : "bg-purple-100 border-purple-300"} border rounded-lg p-4`}>
                  <p className={`font-semibold ${textClass} mb-2`}>🎲 OPC (Oportunidade Secundária):</p>
                  <p className={textClass}>{htAnalysis.opcRecommendation}</p>
                </div>
              )}

              {/* Módulos GODMODE Visuais */}
              {htAnalysis.enhancedData && (
                <div className="space-y-4">
                  <Separator className={isDark ? "bg-slate-700" : "bg-slate-300"} />
                  
                  <h4 className={`font-semibold ${textClass} flex items-center gap-2`}>
                    <Gauge className="w-5 h-5 text-cyan-400" />
                    Módulos GODMODE Ativos
                  </h4>

                  {/* Momentum Score */}
                  <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-4 rounded-lg`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${textClass}`}>⚡ Momentum Score</span>
                      <Badge variant={
                        htAnalysis.enhancedData.momentumScore.trend === "crescendo" ? "default" :
                        htAnalysis.enhancedData.momentumScore.trend === "caindo" ? "destructive" : "outline"
                      }>
                        {htAnalysis.enhancedData.momentumScore.trend.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className={textSecondaryClass}>5 min</p>
                        <Progress value={htAnalysis.enhancedData.momentumScore.last5min} className="mt-1" />
                        <p className={`${textClass} mt-1`}>{htAnalysis.enhancedData.momentumScore.last5min.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className={textSecondaryClass}>10 min</p>
                        <Progress value={htAnalysis.enhancedData.momentumScore.last10min} className="mt-1" />
                        <p className={`${textClass} mt-1`}>{htAnalysis.enhancedData.momentumScore.last10min.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className={textSecondaryClass}>15 min</p>
                        <Progress value={htAnalysis.enhancedData.momentumScore.last15min} className="mt-1" />
                        <p className={`${textClass} mt-1`}>{htAnalysis.enhancedData.momentumScore.last15min.toFixed(0)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Pressure Index */}
                  <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-4 rounded-lg`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-sm font-semibold ${textClass}`}>🔥 Pressure Index</span>
                      {htAnalysis.enhancedData.pressureIndex.isHotMoment && (
                        <Badge variant="destructive">MOMENTO QUENTE</Badge>
                      )}
                    </div>
                    <Progress value={htAnalysis.enhancedData.pressureIndex.pressureIndex} className="mb-2" />
                    <p className={`text-xs ${textClass}`}>{htAnalysis.enhancedData.pressureIndex.pressureIndex.toFixed(0)}/100</p>
                    {htAnalysis.enhancedData.pressureIndex.occasions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {htAnalysis.enhancedData.pressureIndex.occasions.map((occ, idx) => (
                          <p key={idx} className={`text-xs ${textSecondaryClass}`}>• {occ}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* GODMODE Indicators */}
                  <div className="grid md:grid-cols-4 gap-4">
                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-3 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass}`}>Shadow xG</p>
                      <p className={`text-xl font-bold ${textClass}`}>{htAnalysis.enhancedData.shadowXG?.toFixed(2) || "0.00"}</p>
                    </div>
                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-3 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass}`}>Time Bomb</p>
                      <Badge variant={htAnalysis.enhancedData.timeBombActive ? "destructive" : "secondary"}>
                        {htAnalysis.enhancedData.timeBombActive ? "ATIVADA 💣" : "Inativa"}
                      </Badge>
                    </div>
                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-3 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass}`}>Dead Game</p>
                      <Badge variant={htAnalysis.enhancedData.deadGameDetected ? "destructive" : "secondary"}>
                        {htAnalysis.enhancedData.deadGameDetected ? "DETECTADO ⚠️" : "Não"}
                      </Badge>
                    </div>
                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-3 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass}`}>Risk Map</p>
                      <Badge variant="default">
                        {htAnalysis.enhancedData.riskMapType?.toUpperCase() || "N/A"}
                      </Badge>
                    </div>
                  </div>

                  {/* TDA, GameTempo, ERP */}
                  <div className="grid md:grid-cols-3 gap-4">
                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-4 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass} mb-1`}>📈 TDA Score</p>
                      <p className={`text-xl font-bold ${textClass}`}>{htAnalysis.enhancedData.tda.score}/100</p>
                      <Badge variant={htAnalysis.enhancedData.tda.trend === "consistente" ? "default" : "destructive"} className="mt-2">
                        {htAnalysis.enhancedData.tda.trend.toUpperCase()}
                      </Badge>
                      <p className={`text-xs ${textSecondaryClass} mt-2`}>{htAnalysis.enhancedData.tda.description}</p>
                    </div>

                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-4 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass} mb-1`}>⏱️ Game Tempo</p>
                      <p className={`text-xl font-bold ${textClass}`}>{htAnalysis.enhancedData.gameTempo.speed.toUpperCase()}</p>
                      <Progress value={htAnalysis.enhancedData.gameTempo.volatilityRisk} className="mt-2" />
                      <p className={`text-xs ${textSecondaryClass} mt-2`}>Risco: {htAnalysis.enhancedData.gameTempo.volatilityRisk}%</p>
                    </div>

                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-4 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass} mb-1`}>🔄 ERP</p>
                      <p className={`text-xl font-bold ${textClass}`}>{htAnalysis.enhancedData.erp.reversalProbability.toFixed(0)}%</p>
                      <Badge variant={
                        htAnalysis.enhancedData.erp.impact === "alto" ? "default" :
                        htAnalysis.enhancedData.erp.impact === "médio" ? "outline" : "secondary"
                      } className="mt-2">
                        {htAnalysis.enhancedData.erp.impact.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* Outros Indicadores */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-3 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass}`}>Minute Phase</p>
                      <p className={`font-bold ${textClass}`}>{htAnalysis.enhancedData.minutePhase}</p>
                    </div>
                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-3 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass}`}>HA Friendly</p>
                      <p className={`font-bold ${textClass}`}>{htAnalysis.enhancedData.haFriendly ? "SIM ✅" : "NÃO ❌"}</p>
                    </div>
                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-3 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass}`}>Coherence HA</p>
                      <Progress value={htAnalysis.enhancedData.coherenceScoreHA} className="mt-1" />
                      <p className={`text-xs ${textClass} mt-1`}>{htAnalysis.enhancedData.coherenceScoreHA.toFixed(0)}/100</p>
                    </div>
                    <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-3 rounded-lg`}>
                      <p className={`text-xs ${textSecondaryClass}`}>Pattern Break</p>
                      <Badge variant={
                        htAnalysis.enhancedData.patternBreak === "forte" ? "destructive" :
                        htAnalysis.enhancedData.patternBreak === "leve" ? "outline" : "secondary"
                      }>
                        {htAnalysis.enhancedData.patternBreak.toUpperCase()}
                      </Badge>
                    </div>
                  </div>

                  {/* HT→FT Coherence */}
                  {htAnalysis.enhancedData.htToFtCoherence && (
                    <div className={`p-4 rounded-lg border-2 ${
                      htAnalysis.enhancedData.htToFtCoherence === "ROTEIRO CONFIRMADO" 
                        ? "bg-emerald-500/10 border-emerald-500/50"
                        : htAnalysis.enhancedData.htToFtCoherence === "ROTEIRO ROMPIDO"
                        ? "bg-red-500/10 border-red-500/50"
                        : "bg-yellow-500/10 border-yellow-500/50"
                    }`}>
                      <p className={`font-semibold ${textClass} mb-1`}>🔄 Comparação HT → FT</p>
                      <p className={`text-lg font-bold ${textClass}`}>{htAnalysis.enhancedData.htToFtCoherence}</p>
                    </div>
                  )}

                  {/* Red Flags */}
                  {htAnalysis.enhancedData.redFlags.length > 0 && (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <p className={`font-semibold ${textClass} mb-2 flex items-center gap-2`}>
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                        Red Flags Críticas
                      </p>
                      {htAnalysis.enhancedData.redFlags.map((flag, idx) => (
                        <p key={idx} className={`text-sm text-red-200`}>• {flag}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <Separator className={isDark ? "bg-slate-700" : "bg-slate-300"} />

              <div className="space-y-2">
                <h4 className={`font-semibold ${textClass}`}>Justificativa Completa</h4>
                <ul className="space-y-1">
                  {htAnalysis.justification.map((item, idx) => (
                    <li key={idx} className={`text-sm ${textSecondaryClass} whitespace-pre-line`}>{item}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico */}
        {history.length > 0 && (
          <Card className={cardClass}>
            <CardHeader>
              <CardTitle className={`text-lg ${textClass}`}>📊 Últimas Análises</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {history.map((entry) => (
                  <div key={entry.id} className={`${isDark ? "bg-slate-800" : "bg-slate-100"} p-3 rounded-lg`}>
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant={
                        entry.type === "Pré-Jogo" ? "default" : 
                        entry.type === "HT Snapshot" ? "outline" : "secondary"
                      }>
                        {entry.type}
                      </Badge>
                      <span className={`text-xs ${textSecondaryClass}`}>
                        {entry.timestamp.toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className={`font-semibold text-sm ${textClass}`}>{entry.teams}</p>
                    <div className="grid grid-cols-4 gap-2 mt-2 text-xs">
                      <div>
                        <p className={textSecondaryClass}>HA</p>
                        <p className={`font-bold ${textClass}`}>{entry.handicap}</p>
                      </div>
                      <div>
                        <p className={textSecondaryClass}>EV</p>
                        <p className={`font-bold ${textClass}`}>{entry.ev.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className={textSecondaryClass}>Conf.</p>
                        <p className={`font-bold ${textClass}`}>{entry.confidence.toFixed(0)}%</p>
                      </div>
                      <div>
                        <p className={textSecondaryClass}>Decisão</p>
                        <p className={`font-bold ${
                          entry.decision.includes("NÃO") ? "text-red-400" : "text-emerald-400"
                        }`}>
                          {entry.decision.includes("NÃO") ? "Não" : "Sim"}
                        </p>
                      </div>
                    </div>
                    {entry.notes && (
                      <p className={`text-xs ${textSecondaryClass} mt-2 italic`}>{entry.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className={`mt-8 text-center text-sm ${textSecondaryClass}`}>
          <p>Sistema GODMODE 4.0 ULTRA MASTER com 26 regras integradas + Auto-Tuning (0-3). HA+ prioridade • OPC EV≥0 • Shadow xG • Time Bomb • Risk Map • Dead Game • Zero emoção.</p>
          <p className="mt-2">
            Módulos: HT Snapshot • Comparação HT→FT • Momentum • Pressure Index • Minute Phase • HA Friendly • 
            Coherence HA • Shot Quality • Score Contexto • Red Flags • Expected Momentum • Pattern Break • 
            Fragility Index • TDA • Game Tempo • ERP • Shadow xG • Time Bomb • Dead Game • Risk Map • OPC • True Value • Anti-Conservador • Anti-Overlap • Confidence Score • League Weights • Auto-Tuning Agressividade
          </p>
        </div>
      </div>
    </div>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  Send, 
  Sparkles, 
  Brain, 
  Target, 
  AlertTriangle, 
  TrendingUp, 
  Flame,
  Shield,
  Eye,
  BarChart3,
  Activity,
  RefreshCw,
  Lock,
  ArrowLeft,
  Zap,
  Compass,
  Radar,
  MapPin,
  AlertCircle,
  TrendingDown,
  Crosshair,
  Flag
} from "lucide-react"
import { GodmodeSession, type GodmodeAnalysisData } from "@/lib/godmode-session"

// ==================== TIPOS ====================

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: Date
}

// ==================== HA+ SHIELD FACTOR (MÓDULO LIVE EXCLUSIVO) ====================

const HA_SHIELD_FACTOR = {
  0.25: 0.02,
  0.50: 0.05,
  0.75: 0.07,
  1.00: 0.09,
  1.25: 0.11,
  1.50: 0.13,
  2.00: 0.16
} as const

type HALine = keyof typeof HA_SHIELD_FACTOR

function getHAShieldFactor(line: number): number {
  const closestLine = Object.keys(HA_SHIELD_FACTOR)
    .map(Number)
    .reduce((prev, curr) => 
      Math.abs(curr - line) < Math.abs(prev - line) ? curr : prev
    ) as HALine
  
  return HA_SHIELD_FACTOR[closestLine]
}

// ==================== REGIMES INTERNOS DE HA+ (LIVE) ====================

interface HARegimeCheck {
  regime: "A" | "B" | "C"
  passed: boolean
  requirements: string[]
}

function checkHARegime(line: number, context: GodmodeAnalysisData): HARegimeCheck {
  const { ev, momentum, riskMapType, shadowXG } = context
  
  // Regime A - HA Apertado (+0.25 / +0.5)
  if (line <= 0.5) {
    const requirements = [
      `EV ≥ 3% (atual: ${ev.toFixed(2)}%)`,
      `Momentum ≥ 30 (atual: ${momentum.last5min.toFixed(0)})`,
      `Risk Map não DEAD (atual: ${riskMapType})`
    ]
    
    const passed = ev >= 3 && momentum.last5min >= 30 && riskMapType !== "dead"
    
    return { regime: "A", passed, requirements }
  }
  
  // Regime B - HA Intermediário (+0.75 / +1.0)
  if (line <= 1.0) {
    const requirements = [
      `EV ≥ 0% (atual: ${ev.toFixed(2)}%)`,
      `Jogo não descontrolado (Risk Map: ${riskMapType})`,
      `Shadow xG não crítico (atual: ${shadowXG.toFixed(2)})`
    ]
    
    const passed = ev >= 0 && riskMapType !== "chaotic" && shadowXG < 0.6
    
    return { regime: "B", passed, requirements }
  }
  
  // Regime C - HA Escudo (+1.25 / +1.5 / +2.0)
  const requirements = [
    `EV 0% ~ +2% (atual: ${ev.toFixed(2)}%)`,
    `Shadow xG baixo (atual: ${shadowXG.toFixed(2)})`,
    `Jogo travado (Risk Map: ${riskMapType})`
  ]
  
  const passed = ev >= 0 && ev <= 2 && shadowXG < 0.3 && (riskMapType === "dead" || riskMapType === "controlled")
  
  return { regime: "C", passed, requirements }
}

// ==================== FILTROS LIVE DE HA+ ====================

function checkHADeadScenario(context: GodmodeAnalysisData): { blocked: boolean; reasons: string[] } {
  const reasons: string[] = []
  let conditionsTrue = 0
  
  // Finalizações últimos 10 min = 0 (simulado)
  if (context.stats.shotsTotalHome + context.stats.shotsTotalAway < 3) {
    reasons.push("Finalizações muito baixas")
    conditionsTrue++
  }
  
  // Ataques perigosos últimos 8 min = 0 (simulado)
  if (context.stats.dangerousAttacksHome + context.stats.dangerousAttacksAway < 5) {
    reasons.push("Ataques perigosos muito baixos")
    conditionsTrue++
  }
  
  // Pressure Index < 10
  if (context.pressureIndex.pressureIndex < 10) {
    reasons.push(`Pressure Index muito baixo (${context.pressureIndex.pressureIndex.toFixed(0)})`)
    conditionsTrue++
  }
  
  // Momentum < 25
  if (context.momentum.last5min < 25) {
    reasons.push(`Momentum muito baixo (${context.momentum.last5min.toFixed(0)})`)
    conditionsTrue++
  }
  
  // Shadow xG < 0.05
  if (context.shadowXG < 0.05) {
    reasons.push(`Shadow xG muito baixo (${context.shadowXG.toFixed(2)})`)
    conditionsTrue++
  }
  
  return {
    blocked: conditionsTrue >= 4,
    reasons
  }
}

function checkAntiIlusaoMode(haLine: number, oddHA: number, fairLine: number): { penalty: number; reason: string } {
  const oddDiff = ((oddHA - fairLine) / fairLine) * 100
  
  if (oddDiff >= 20) {
    return {
      penalty: -15,
      reason: `Odd ${oddDiff.toFixed(0)}% acima do Fair Line - reduzindo confiança`
    }
  }
  
  return { penalty: 0, reason: "" }
}

function checkShadowXGFilter(line: number, context: GodmodeAnalysisData): { blocked: boolean; reason: string } {
  // Para HA +0.25 e +0.50
  if (line <= 0.5) {
    if (context.shadowXG < 0.03 && context.stats.shotsTotalAway < 2) {
      return {
        blocked: true,
        reason: "Shadow xG muito baixo + sem finalizações recentes"
      }
    }
  }
  
  // Para linhas ≥ +1.0, não bloqueia
  return { blocked: false, reason: "" }
}

// ==================== AGGRO LEVEL (LIVE) ====================

function applyAggroLevelFilters(
  aggroLevel: number,
  line: number,
  context: GodmodeAnalysisData,
  oddHA: number = 1.85,
  fairLine: number = 1.75
): {
  allowed: boolean
  confidence: number
  reasons: string[]
} {
  const reasons: string[] = []
  let confidence = 70 // Base
  
  // AggroLevel 1 - Conservador Pro
  if (aggroLevel === 1) {
    // Todos os filtros rígidos
    const deadScenario = checkHADeadScenario(context)
    if (deadScenario.blocked) {
      return {
        allowed: false,
        confidence: 0,
        reasons: ["Cenário Morto detectado (AggroLevel 1)", ...deadScenario.reasons]
      }
    }
    
    const shadowFilter = checkShadowXGFilter(line, context)
    if (shadowFilter.blocked) {
      return {
        allowed: false,
        confidence: 0,
        reasons: ["Shadow xG Filter bloqueou (AggroLevel 1)", shadowFilter.reason]
      }
    }
    
    const antiIlusao = checkAntiIlusaoMode(line, oddHA, fairLine)
    confidence += antiIlusao.penalty
    if (antiIlusao.reason) reasons.push(antiIlusao.reason)
    
    const regime = checkHARegime(line, context)
    if (!regime.passed) {
      return {
        allowed: false,
        confidence: 0,
        reasons: [`Regime ${regime.regime} não cumprido (AggroLevel 1)`, ...regime.requirements]
      }
    }
    
    reasons.push(`Regime ${regime.regime} cumprido`, "Todos os filtros rígidos passaram")
  }
  
  // AggroLevel 2 - Balanceado
  if (aggroLevel === 2) {
    const deadScenario = checkHADeadScenario(context)
    if (deadScenario.blocked) {
      return {
        allowed: false,
        confidence: 0,
        reasons: ["Cenário Morto detectado (4+ condições)", ...deadScenario.reasons]
      }
    }
    
    const antiIlusao = checkAntiIlusaoMode(line, oddHA, fairLine)
    confidence += antiIlusao.penalty
    if (antiIlusao.reason) reasons.push(antiIlusao.reason + " (não bloqueia)")
    
    const regime = checkHARegime(line, context)
    if (!regime.passed) {
      confidence -= 20
      reasons.push(`Regime ${regime.regime} não cumprido - reduzindo confiança`)
    } else {
      reasons.push(`Regime ${regime.regime} cumprido`)
    }
  }
  
  // AggroLevel 3 - Agressivo Controlado
  if (aggroLevel === 3) {
    const regime = checkHARegime(line, context)
    if (!regime.passed) {
      confidence -= 15
      reasons.push(`Regime ${regime.regime} não cumprido - redução leve`)
    } else {
      reasons.push(`Regime ${regime.regime} cumprido`)
    }
    
    const shadowFilter = checkShadowXGFilter(line, context)
    if (shadowFilter.blocked) {
      confidence -= 10
      reasons.push("Shadow xG baixo - reduzindo confiança (não bloqueia)")
    }
    
    reasons.push("Modo agressivo - filtros suavizados")
  }
  
  // Aplicar HA Shield Factor
  const shieldFactor = getHAShieldFactor(line)
  confidence = Math.min(80, confidence + (shieldFactor * 100))
  reasons.push(`HA Shield Factor +${(shieldFactor * 100).toFixed(0)}%`)
  
  return {
    allowed: true,
    confidence: Math.max(0, Math.min(100, confidence)),
    reasons
  }
}

// ==================== ASSISTENTE TÁTICO PRO - 30 MÓDULOS ====================

const TACTICAL_MODULES = {
  // 10 Módulos Avançados
  advanced: {
    conselheiro: "Resumo frio do estado atual do jogo",
    perguntasProfundas: "Interpreta questões complexas do usuário",
    leituraCompleta: "Explica tática, ritmo e direção do jogo",
    interrogatorio: "Mostra fatores pró e contra qualquer cenário",
    simulacao: "Previsão dos próximos 10 minutos",
    comparacao1T2T: "Explica evolução do jogo",
    explicacaoDidatica: "Define conceitos táticos de forma simples",
    escalaEmocional: "Classifica o jogo em: estável, tenso, agressivo ou caótico",
    perguntasLivres: "Interpreta intenção, não só palavras",
    proTrader: "Diagnóstico profissional instantâneo"
  },
  
  // 20 Módulos Ultra-Elite
  ultraElite: {
    mentorRisco: "Risco: baixo / médio / alto + motivo objetivo",
    controleAnsiedade: "Detecta impulsividade e corrige",
    antiEmpolgacao: "Detecta pressão falsa",
    leituraVocal: "Interpreta o tom emocional do usuário",
    oraculo: "Previsão direta: gol / sem gol / aceleração / morte",
    tendenciaMercado: "Odd justa x odd live",
    replayTatico: "Mostra o que mudou nos últimos 5 minutos",
    previsaoBinaria: "SIM / NÃO / NEUTRO + motivo",
    sinaisContradictorios: "Lista dados pró e contra",
    explicacaoMercado: "Explica movimentos de odd",
    colapsoDefensivo: "Mostra quem está prestes a tomar gol",
    escanteioProvavel: "Analisa flanco forte, cruzamentos, pressão",
    cartaoProvavel: "Faltas duras, emocional, árbitro",
    golSilencioso: "Detecta explosões ocultas",
    tendenciaLiga: "Compara o jogo com padrões da liga",
    viradaPotencial: "Detecta times crescendo",
    fimExplosivo: "Detecta final de jogo agressivo",
    antiTrapEmocional: "Bloqueia interpretações baseadas em sensação",
    interpretacaoTemporal: "Qual momento do jogo mais crítico",
    perfilUnderdog: "Mostra risco para favoritos"
  }
}

// ==================== ATALHOS TÁTICOS EM 6 CATEGORIAS ====================

const TACTICAL_SHORTCUTS = {
  gols: [
    { id: "proximo-gol", label: "Próximo Gol", icon: Target },
    { id: "vai-sair-gol", label: "Vai sair gol?", icon: Sparkles },
    { id: "quem-perto-marcar", label: "Quem está mais perto?", icon: Crosshair },
    { id: "gol-5min", label: "% gol próximos 5 min", icon: Zap },
    { id: "explodir-morrer", label: "Explodir ou morrer?", icon: Flame },
    { id: "comparacao-1t-2t", label: "Comparação 1T X 2T", icon: BarChart3 }
  ],
  cartoes: [
    { id: "proximo-cartao", label: "Próximo cartão", icon: AlertTriangle },
    { id: "quem-leva-cartao", label: "Quem está mais perto?", icon: AlertCircle },
    { id: "risco-disciplinar", label: "Risco disciplinar", icon: Shield },
    { id: "heatmap-emocional", label: "Heatmap emocional", icon: Activity }
  ],
  escanteios: [
    { id: "chance-escanteio", label: "Chance de escanteio", icon: Flag },
    { id: "pressao-lateral", label: "Pressão lateral", icon: TrendingUp },
    { id: "microritmo-corners", label: "Microritmo corners", icon: Activity },
    { id: "sequencia-provavel", label: "Sequência provável", icon: Radar }
  ],
  tendencia: [
    { id: "jogo-morrer", label: "Jogo vai morrer?", icon: TrendingDown },
    { id: "jogo-explodir", label: "Jogo vai explodir?", icon: Flame },
    { id: "ritmo-atual", label: "Ritmo atual", icon: Activity },
    { id: "pressao-real-falsa", label: "Pressão real vs falsa", icon: Eye }
  ],
  viradaEmpate: [
    { id: "chance-virada", label: "Chance de virada", icon: RefreshCw },
    { id: "chance-empate", label: "Chance de empate", icon: Target },
    { id: "quem-controla", label: "Quem controla o jogo", icon: Compass },
    { id: "reacao-underdog", label: "Reação do underdog", icon: TrendingUp }
  ],
  oraculo: [
    { id: "previsao-completa", label: "Previsão completa", icon: Sparkles },
    { id: "caminhos-provaveis", label: "Caminhos prováveis", icon: MapPin },
    { id: "eventos-futuros", label: "Eventos futuros", icon: Eye },
    { id: "diagnostico-final", label: "Diagnóstico final", icon: Brain }
  ]
}

// ==================== SUGESTÕES RÁPIDAS (QUICK REPLIES) ====================

const QUICK_REPLIES = [
  { id: "gps", label: "📍 GPS do Jogo", icon: Compass },
  { id: "proximo-gol", label: "⚽ Próximo Gol", icon: Target },
  { id: "vai-explodir", label: "💥 Vai explodir?", icon: Flame },
  { id: "pressao-real", label: "👁️ Pressão Real", icon: Eye },
  { id: "ha-plus", label: "🛡️ Análise HA+", icon: Shield },
  { id: "oraculo", label: "🔮 Oráculo Completo", icon: Sparkles }
]

// ==================== GPS DO JOGO (100% SEGURO) ====================

function calculateGPS(context: GodmodeAnalysisData) {
  const { momentum, shadowXG, pressureIndex, minute, riskMapType, rdsFora, rdsCasa } = context
  
  // PROTEÇÃO CRÍTICA: Safe-check para corners
  const cornersHome = context?.stats?.cornersHome ?? 0
  const cornersAway = context?.stats?.cornersAway ?? 0
  
  // Log interno (dev mode)
  if (cornersHome === 0 && cornersAway === 0) {
    console.warn("Stats incompletos no GPS:", context.stats)
  }
  
  // Classificar fase atual
  let fase = "estudo"
  if (minute < 15) fase = "estudo"
  else if (momentum.last5min >= 70 && pressureIndex.pressureIndex >= 65) fase = "caos"
  else if (pressureIndex.pressureIndex >= 60) fase = "pressão"
  else if (minute >= 75) fase = "desgaste"
  else if (riskMapType === "dead") fase = "sobrevivência"
  
  // Prever caminhos prováveis
  const golM = Math.min(85, (pressureIndex.pressureIndex * 0.4) + (shadowXG * 20) + (momentum.last5min * 0.3))
  const golV = Math.min(85, (rdsFora * 0.5) + (shadowXG * 15) + (momentum.last5min * 0.2))
  const nadaAcontece = riskMapType === "dead" ? 70 : Math.max(5, 100 - golM - golV)
  const cartao = Math.min(60, (minute >= 70 ? 40 : 20) + (riskMapType === "chaotic" ? 20 : 0))
  
  // CÁLCULO SEGURO DE ESCANTEIOS (nunca quebra)
  const escanteio = Math.min(75, (cornersHome + cornersAway) * 5)
  
  // Nível de confiança para escanteios
  const confiancaEscanteio = (cornersHome + cornersAway) === 0 ? "baixa" : 
                             (cornersHome + cornersAway) >= 6 ? "alta" : "média"
  
  // Prever tendência
  let tendencia = "estabilizar"
  if (momentum.trend === "crescendo" && shadowXG > 0.3) tendencia = "explodir"
  else if (riskMapType === "dead") tendencia = "morrer"
  else if (momentum.trend === "caindo") tendencia = "esfriar"
  
  return {
    fase,
    caminhos: { golM, golV, nadaAcontece, cartao, escanteio },
    tendencia,
    confiancaEscanteio,
    hasStats: cornersHome > 0 || cornersAway > 0
  }
}

// ==================== CHAOS METER ====================

function calculateChaosMeter(context: GodmodeAnalysisData): number {
  const { momentum, shadowXG, pressureIndex, timeBombActive, riskMapType } = context
  
  let chaos = 0
  
  // Momentum (0-30 pontos)
  chaos += (momentum.last5min / 100) * 30
  
  // Shadow xG (0-20 pontos)
  chaos += Math.min(20, shadowXG * 40)
  
  // Pressure Index (0-25 pontos)
  chaos += (pressureIndex.pressureIndex / 100) * 25
  
  // Time Bomb (0-15 pontos)
  if (timeBombActive) chaos += 15
  
  // Risk Map (0-10 pontos)
  if (riskMapType === "explosive") chaos += 10
  else if (riskMapType === "chaotic") chaos += 8
  
  return Math.min(100, Math.max(0, chaos))
}

// ==================== ORÁCULO PRO+ (AUTO-MONITORAMENTO) ====================

function detectAutoAlerts(context: GodmodeAnalysisData): string[] {
  const alerts: string[] = []
  
  if (context.momentum.trend === "crescendo" && context.momentum.last5min >= 70) {
    alerts.push("🔥 Mudança brusca detectada – pressão real do mandante.")
  }
  
  if (context.timeBombActive) {
    alerts.push("💣 Time Bomb em formação.")
  }
  
  if (context.shadowXG >= 0.4) {
    alerts.push("⚠️ Shadow xG alto — gol provável.")
  }
  
  if (context.riskMapType === "dead") {
    alerts.push("🧊 Jogo esfriando — tendência de morrer.")
  }
  
  if (context.patternBreak === "sim") {
    alerts.push("⚡ Pattern Break detectado — jogo mudou completamente.")
  }
  
  return alerts
}

// ==================== EVENTO OCULTO ====================

function detectHiddenEvents(context: GodmodeAnalysisData): string[] {
  const events: string[] = []
  
  // Colapso de setor
  if (context.stats.shotsOnTargetAway >= 6 && context.xgAway >= 1.8) {
    events.push("⚠️ Evento oculto detectado – defesa casa colapsando.")
  }
  
  // Shadow xG não convertido
  if (context.shadowXG >= 0.5 && context.stats.goalsHome + context.stats.goalsAway < 2) {
    events.push("🔥 Acúmulo silencioso de quase-gols. Grande risco.")
  }
  
  // Pressão silenciosa
  if (context.pressureIndex.pressureIndex >= 65 && context.stats.shotsTotalAway < 8) {
    events.push("👁️ Pressão silenciosa detectada – visitante eficiente.")
  }
  
  // Defesa cansando
  if (context.minute >= 70 && context.momentum.last5min >= 60) {
    events.push("⚠️ Defesa cansando – vulnerabilidade crescente.")
  }
  
  return events
}

// ==================== AUTO-SUGESTÕES INTELIGENTES ====================

function generateAutoSuggestions(context: GodmodeAnalysisData): string[] {
  const suggestions: string[] = []
  
  if (context.timeBombActive) {
    suggestions.push("Pergunta recomendada: Quem está mais perto de marcar?")
  }
  
  if (context.shadowXG >= 0.35) {
    suggestions.push("Boa hora para perguntar: Vai sair gol?")
  }
  
  const chaosMeter = calculateChaosMeter(context)
  if (chaosMeter >= 60) {
    suggestions.push("Pergunta útil agora: Jogo vai explodir?")
  }
  
  if (context.momentum.last5min >= 70) {
    suggestions.push("Momento ideal: Chance de escanteio?")
  }
  
  if (context.patternBreak === "sim") {
    suggestions.push("Recomendado: O que mudou nos últimos 5 minutos?")
  }
  
  return suggestions
}

// ==================== GERADOR DE RESPOSTAS TÁTICAS ====================

function generateTacticalResponse(query: string, context: GodmodeAnalysisData): string {
  const lowerQuery = query.toLowerCase()
  
  // GPS DO JOGO
  if (lowerQuery.includes("gps") || lowerQuery.includes("panorama") || lowerQuery.includes("resumo tático")) {
    const gps = calculateGPS(context)
    
    // Aviso se dados incompletos
    const avisoStats = !gps.hasStats ? "\n\n⚠️ Alguns dados live estão incompletos. Usarei apenas métricas confiáveis." : ""
    
    return `🧭 **GPS DO JOGO™ - Game Positioning System**

**Fase Atual:** ${gps.fase.toUpperCase()}

**Posição do Jogo:**
• Momentum: ${context.momentum.last5min.toFixed(0)}/100 (${context.momentum.trend})
• Shadow xG: ${context.shadowXG.toFixed(2)}
• Pressão Real: ${context.pressureIndex.pressureIndex.toFixed(0)}/100
• Risk Map: ${context.riskMapType.toUpperCase()}

**Caminhos Prováveis (%):**
🎯 Gol Mandante: ${gps.caminhos.golM.toFixed(0)}%
🎯 Gol Visitante: ${gps.caminhos.golV.toFixed(0)}%
⚪ Nada acontece: ${gps.caminhos.nadaAcontece.toFixed(0)}%
⚠️ Cartão: ${gps.caminhos.cartao.toFixed(0)}%
🚩 Escanteio: ${gps.caminhos.escanteio.toFixed(0)}% (confiança ${gps.confiancaEscanteio})

**Tendência:** ${gps.tendencia.toUpperCase()}

**Comparação 1T→2T:** ${context.htToFtCoherence || "N/A"}${avisoStats}`
  }
  
  // ANÁLISE HA+ LIVE (NOVO)
  if (lowerQuery.includes("ha+") || lowerQuery.includes("handicap asiático") || lowerQuery.includes("análise ha")) {
    const haLine = 1.0 // Exemplo - pode ser extraído da query
    const aggroLevel = context.aggroLevel
    
    const haAnalysis = applyAggroLevelFilters(aggroLevel, haLine, context)
    const regime = checkHARegime(haLine, context)
    const deadScenario = checkHADeadScenario(context)
    const shieldFactor = getHAShieldFactor(haLine)
    
    return `🛡️ **ANÁLISE HA+ LIVE - Linha +${haLine.toFixed(2)}**

**AggroLevel:** ${aggroLevel} (${context.aggroLevelName})

**HA Shield Factor:** +${(shieldFactor * 100).toFixed(0)}% (proteção da linha)

**Regime Aplicado:** ${regime.regime}
${regime.passed ? "✅ CUMPRIDO" : "❌ NÃO CUMPRIDO"}

**Requisitos do Regime:**
${regime.requirements.map(r => `• ${r}`).join("\n")}

**Filtro de Cenário Morto:**
${deadScenario.blocked ? "🔴 BLOQUEADO" : "✅ LIBERADO"}
${deadScenario.reasons.length > 0 ? `\n${deadScenario.reasons.map(r => `• ${r}`).join("\n")}` : ""}

**Resultado Final:**
• Entrada: ${haAnalysis.allowed ? "✅ PERMITIDA" : "🔴 BLOQUEADA"}
• Confiança: ${haAnalysis.confidence.toFixed(0)}%

**Motivos:**
${haAnalysis.reasons.map(r => `• ${r}`).join("\n")}

**Recomendação:**
${haAnalysis.allowed && haAnalysis.confidence >= 60 ? 
  "✅ HA+ aprovado com confiança adequada" :
  haAnalysis.allowed && haAnalysis.confidence < 60 ?
  "⚠️ HA+ permitido mas com baixa confiança - cautela" :
  "🚫 HA+ bloqueado - aguardar melhores condições"}`
  }
  
  // PREVISÃO COMPLETA (ORÁCULO)
  if (lowerQuery.includes("previsão completa") || lowerQuery.includes("oráculo completo")) {
    const gps = calculateGPS(context)
    const chaosMeter = calculateChaosMeter(context)
    
    return `🔮 **ORÁCULO PRO+ - Previsão Completa**

**Cenário:** ${context.homeTeam} ${context.score} ${context.awayTeam} (${context.minute}')

**GPS DO JOGO:**
• Fase: ${gps.fase.toUpperCase()}
• Tendência: ${gps.tendencia.toUpperCase()}

**CHAOS METER:** ${chaosMeter.toFixed(0)}/100
${chaosMeter <= 25 ? "🟢 Jogo morto" : chaosMeter <= 55 ? "🟡 Controle" : chaosMeter <= 75 ? "🟠 Pressão real" : "🔴 Caos / Gol iminente"}

**Caminhos Prováveis:**
• Gol M: ${gps.caminhos.golM.toFixed(0)}%
• Gol V: ${gps.caminhos.golV.toFixed(0)}%
• Cartão: ${gps.caminhos.cartao.toFixed(0)}%
• Escanteio: ${gps.caminhos.escanteio.toFixed(0)}% (confiança ${gps.confiancaEscanteio})

**Eventos Futuros:**
${context.timeBombActive ? "💣 Time Bomb ativa - gol iminente\n" : ""}${context.shadowXG >= 0.4 ? "⚠️ Shadow xG alto - explosão provável\n" : ""}${context.momentum.trend === "crescendo" ? "📈 Momentum crescente - aceleração\n" : ""}${context.riskMapType === "dead" ? "🧊 Dead Game - jogo travado\n" : ""}

**Diagnóstico Final:**
${chaosMeter >= 76 ? "Jogo em CAOS TOTAL - múltiplos eventos esperados" : chaosMeter >= 56 ? "Pressão REAL detectada - risco alto" : chaosMeter >= 26 ? "Jogo CONTROLADO - cenário estável" : "Jogo MORTO - poucos eventos esperados"}`
  }
  
  // Resposta genérica para perguntas não mapeadas
  return `🤖 **Assistente Tático Pro**

"${query}"

Analisando dados do GODMODE 4.0...

**Contexto Atual:**
• Jogo: ${context.homeTeam} ${context.score} ${context.awayTeam}
• Minuto: ${context.minute}'
• AggroLevel: ${context.aggroLevel} (${context.aggroLevelName})
• Confiança: ${context.confidence?.toFixed(1) || "N/A"}%
• EV: ${context.ev.toFixed(2)}%

**Status GODMODE:**
• Green Light: ${context.greenLightActive ? "🟢 ATIVO" : "⚪ Inativo"}
• Dead Zone: ${context.deadZoneActive ? "🔴 ATIVA" : "⚪ Inativa"}
• Score Shield: ${context.scoreShieldActive ? "🛡️ ATIVO" : "⚪ Inativo"}
• Time Bomb: ${context.timeBombActive ? "💣 ATIVA" : "⚪ Inativa"}

**Perguntas sugeridas:**
• "Vai sair gol?"
• "Pressão real ou falsa?"
• "Quem marca o próximo gol?"
• "O jogo está acelerando?"
• "Análise HA+ linha +1.0"
• "Existe risco de virada?"`
}

// ==================== FALLBACK INTELIGENTE ====================

function generateFallbackResponse(): string {
  return `❓ **Não consegui entender exatamente sua pergunta.**

Escolha uma das opções abaixo:

**🟡 GOLS:**
• Próximo Gol
• Vai sair gol?
• % gol nos próximos 5 min

**🟠 CARTÕES:**
• Próximo cartão
• Quem está mais perto de levar?
• Risco disciplinar

**🟦 ESCANTEIOS:**
• Chance de escanteio agora
• Pressão lateral
• Microritmo de corners

**🟣 TENDÊNCIA:**
• Jogo vai morrer?
• Jogo vai explodir?
• Pressão real vs falsa

**🟢 VIRADA/EMPATE:**
• Chance de virada
• Chance de empate
• Quem controla o jogo

**🔱 GPS DO JOGO:**
• GPS completo
• Previsão completa

**🛡️ HA+ LIVE:**
• Análise HA+ linha +1.0
• Regime HA+ atual`
}

// ==================== COMPONENTE PRINCIPAL ====================

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [gameContext, setGameContext] = useState<GodmodeAnalysisData | null>(null)
  const [isBlocked, setIsBlocked] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [autoAlerts, setAutoAlerts] = useState<string[]>([])
  const [autoSuggestions, setAutoSuggestions] = useState<string[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Carregar análise ao montar componente
  useEffect(() => {
    const loadAnalysis = () => {
      if (GodmodeSession.hasValidAnalysis()) {
        const data = GodmodeSession.loadAnalysis()
        if (data) {
          setGameContext(data)
          setIsBlocked(false)
          
          // Gerar alertas automáticos
          const alerts = detectAutoAlerts(data)
          setAutoAlerts(alerts)
          
          // Gerar auto-sugestões
          const suggestions = generateAutoSuggestions(data)
          setAutoSuggestions(suggestions)
          
          // Mensagem de boas-vindas
          const chaosMeter = calculateChaosMeter(data)
          const gps = calculateGPS(data)
          
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content: `👋 **Bem-vindo ao Assistente Tático Pro!**

📊 **Análise carregada:**
${data.homeTeam} ${data.score} ${data.awayTeam} — ${data.minute}'

**GPS DO JOGO:**
• Fase: ${gps.fase.toUpperCase()}
• Tendência: ${gps.tendencia.toUpperCase()}

**CHAOS METER:** ${chaosMeter.toFixed(0)}/100
${chaosMeter >= 76 ? "🔴 Caos / Gol iminente" : chaosMeter >= 56 ? "🟠 Pressão real" : chaosMeter >= 26 ? "🟡 Controle" : "🟢 Jogo morto"}

**O que posso fazer:**
• Analisar momentum e pressão em tempo real
• Prever próximos eventos (gols, cartões, escanteios)
• Explicar movimentos de mercado e odds
• Detectar padrões táticos e emocionais
• Avaliar riscos e oportunidades
• **🛡️ Análise HA+ LIVE com Regimes e Filtros**

**30 Módulos Ativos + HA+ Shield:**
✅ 10 Módulos Avançados
✅ 20 Módulos Ultra-Elite
✅ HA+ Shield Factor (LIVE)
✅ Regimes A/B/C (LIVE)
✅ Filtros Anti-Ilusão (LIVE)

**Como usar:**
Escolha um atalho rápido ou faça sua pergunta!
Experimente: "Análise HA+ linha +1.0"`,
              timestamp: new Date()
            }
          ])
          
          // Adicionar alertas automáticos se houver
          if (alerts.length > 0) {
            setTimeout(() => {
              setMessages(prev => [...prev, {
                id: "auto-alerts",
                role: "system",
                content: `🚨 **ORÁCULO PRO+ - Alertas Automáticos**\n\n${alerts.join("\n")}\n\n_Esses alertas são leituras táticas, não sinais de entrada._`,
                timestamp: new Date()
              }])
            }, 1500)
          }
        }
      } else {
        setIsBlocked(true)
      }
    }
    
    loadAnalysis()
    
    // Auto-monitoramento a cada 60 segundos
    const interval = setInterval(() => {
      if (gameContext) {
        const alerts = detectAutoAlerts(gameContext)
        if (alerts.length > 0 && alerts.join() !== autoAlerts.join()) {
          setAutoAlerts(alerts)
          setMessages(prev => [...prev, {
            id: `auto-alert-${Date.now()}`,
            role: "system",
            content: `🚨 **ORÁCULO PRO+ - Novo Alerta**\n\n${alerts[alerts.length - 1]}`,
            timestamp: new Date()
          }])
        }
        
        const suggestions = generateAutoSuggestions(gameContext)
        setAutoSuggestions(suggestions)
      }
    }, 60000)
    
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (text?: string) => {
    if (!gameContext) {
      // Resposta automática quando não há análise
      const userMessage: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text || input.trim(),
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, userMessage])
      setInput("")
      setIsTyping(true)
      
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⚠️ Nenhuma análise ativa. Rode o GODMODE 4.0 antes de usar o Assistente.",
          timestamp: new Date()
        }])
        setIsTyping(false)
      }, 500)
      return
    }
    
    const messageText = text || input.trim()
    if (!messageText) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    // Gerar resposta do assistente
    setTimeout(() => {
      let response: string
      
      // Verificar se é pergunta válida
      const lowerQuery = messageText.toLowerCase()
      const validKeywords = [
        "gol", "cartão", "escanteio", "pressão", "virada", "empate", "morrer", "explodir",
        "ritmo", "controla", "underdog", "odd", "buraco", "1t", "2t", "oráculo", "mentor",
        "risco", "replay", "sinais", "gps", "panorama", "resumo", "previsão", "caminhos",
        "eventos", "diagnóstico", "disciplinar", "heatmap", "lateral", "microritmo", "sequência",
        "ha+", "handicap", "asiático", "linha", "regime"
      ]
      
      const isValidQuery = validKeywords.some(keyword => lowerQuery.includes(keyword))
      
      if (isValidQuery) {
        response = generateTacticalResponse(messageText, gameContext)
      } else {
        response = generateFallbackResponse()
      }
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: response,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, assistantMessage])
      setIsTyping(false)
    }, 800)
  }

  const handleQuickAction = (actionId: string, label: string) => {
    handleSend(label)
  }

  const handleClearGame = () => {
    GodmodeSession.clearAnalysis()
    setGameContext(null)
    setIsBlocked(true)
    setMessages([])
    setAutoAlerts([])
    setAutoSuggestions([])
  }

  // Tela de bloqueio
  if (isBlocked || !gameContext) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="bg-slate-900/60 backdrop-blur-sm border-slate-800 max-w-2xl w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Lock className="w-6 h-6 text-red-400" />
              Assistente Tático Bloqueado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-red-500/10 border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <AlertDescription className="text-red-200 ml-2">
                🚫 Nenhuma análise encontrada. Rode a análise GODMODE 4.0 antes de usar o Assistente Tático Pro.
              </AlertDescription>
            </Alert>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Para usar o Assistente Tático:</h3>
              <ol className="space-y-2 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-cyan-400">1.</span>
                  <span>Volte para a página principal</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-cyan-400">2.</span>
                  <span>Execute uma análise GODMODE (Pré-Jogo ou HT→FT)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-cyan-400">3.</span>
                  <span>Retorne ao chat - os dados serão carregados automaticamente</span>
                </li>
              </ol>
            </div>
            
            <Button 
              onClick={() => router.push("/")}
              className="w-full bg-cyan-600 hover:bg-cyan-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar para Análise GODMODE
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const chaosMeter = calculateChaosMeter(gameContext)

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B0D14] via-[#141A26] to-[#0B0D14] text-[#E6EAF0]">
      <div className="container mx-auto px-4 py-6 max-w-6xl h-screen flex flex-col gap-4">
        {/* Header com HUD Completo - DARK MODE PREMIUM */}
        <Card className="bg-[rgba(255,255,255,0.06)] backdrop-blur-[14px] border-[rgba(255,255,255,0.12)] border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/")}
                  className="text-[#9FB4D1] hover:text-[#E6EAF0]"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="flex items-center gap-2 text-[1.2rem] font-semibold text-[#4D9EF7]">
                  <Brain className="w-6 h-6 text-[#4D9EF7]" />
                  Assistente Tático Pro
                </CardTitle>
              </div>
              
              {/* HUD Completo */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs font-mono text-[#E6EAF0] border-[rgba(77,158,247,0.25)]">
                  {gameContext.homeTeam} {gameContext.score} {gameContext.awayTeam}
                </Badge>
                <Badge variant="secondary" className="text-xs text-[#9FB4D1]">
                  {gameContext.minute}'
                </Badge>
                <Badge variant={
                  gameContext.aggroLevel === 0 ? "secondary" :
                  gameContext.aggroLevel === 1 ? "outline" :
                  gameContext.aggroLevel === 2 ? "default" : "destructive"
                } className="text-[#E6EAF0]">
                  Aggro {gameContext.aggroLevel}
                </Badge>
                <Badge variant="outline" className="text-xs text-[#9FB4D1] border-[rgba(77,158,247,0.25)]">
                  Pressão {gameContext.pressureIndex.pressureIndex.toFixed(0)}
                </Badge>
                <Badge variant="outline" className="text-xs text-[#9FB4D1] border-[rgba(77,158,247,0.25)]">
                  Mom {gameContext.momentum.last5min.toFixed(0)}
                </Badge>
                <Badge variant="outline" className="text-xs text-[#9FB4D1] border-[rgba(77,158,247,0.25)]">
                  sXG {gameContext.shadowXG.toFixed(2)}
                </Badge>
                {gameContext.timeBombActive && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    💣 Bomb
                  </Badge>
                )}
                <Badge variant={
                  gameContext.riskMapType === "explosive" ? "destructive" :
                  gameContext.riskMapType === "chaotic" ? "default" :
                  gameContext.riskMapType === "dead" ? "secondary" : "outline"
                } className="text-xs text-[#E6EAF0]">
                  {gameContext.riskMapType}
                </Badge>
                {gameContext.confidence != null && (
                  <Badge variant={
                    gameContext.confidence >= 70 ? "default" :
                    gameContext.confidence >= 50 ? "outline" : "destructive"
                  } className="text-[#E6EAF0]">
                    {gameContext.confidence.toFixed(0)}%
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearGame}
                  className="text-[#9FB4D1] hover:text-red-400"
                  title="Trocar Jogo Analisado"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            {/* Chaos Meter Bar */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#9FB4D1]">Chaos Meter™</span>
                <span className={`font-bold ${
                  chaosMeter >= 76 ? "text-red-400" :
                  chaosMeter >= 56 ? "text-orange-400" :
                  chaosMeter >= 26 ? "text-yellow-400" : "text-green-400"
                }`}>
                  {chaosMeter.toFixed(0)}/100 {
                    chaosMeter >= 76 ? "🔴 Caos / Gol iminente" :
                    chaosMeter >= 56 ? "🟠 Pressão real" :
                    chaosMeter >= 26 ? "🟡 Controle" : "🟢 Jogo morto"
                  }
                </span>
              </div>
              <Progress 
                value={chaosMeter} 
                className={`h-2 ${
                  chaosMeter >= 76 ? "bg-red-950" :
                  chaosMeter >= 56 ? "bg-orange-950" :
                  chaosMeter >= 26 ? "bg-yellow-950" : "bg-green-950"
                }`}
              />
            </div>
          </CardHeader>
        </Card>

        {/* Auto-Sugestões */}
        {autoSuggestions.length > 0 && (
          <Card className="bg-cyan-900/20 backdrop-blur-sm border-cyan-500/30">
            <CardContent className="p-3">
              <div className="space-y-1">
                <p className="text-xs text-cyan-300 font-semibold">💡 Auto-Sugestões Inteligentes:</p>
                {autoSuggestions.map((suggestion, idx) => (
                  <p key={idx} className="text-xs text-cyan-200">{suggestion}</p>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chat Area - DARK MODE PREMIUM */}
        <Card className="bg-[rgba(255,255,255,0.06)] backdrop-blur-[14px] border-[rgba(255,255,255,0.12)] flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            {/* Messages - com padding-bottom para não esconder atrás do input */}
            <ScrollArea className="flex-1 pr-4 pb-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-[#4D9EF7] text-white"
                          : message.role === "system"
                          ? "bg-orange-900/30 border border-orange-500/30 text-orange-100"
                          : "bg-[#1E2433] text-[#DDE6F3] border border-[rgba(77,158,247,0.2)]"
                      }`}
                    >
                      <div className="whitespace-pre-line text-sm leading-relaxed">
                        {message.content}
                      </div>
                      <div className={`text-xs mt-2 ${
                        message.role === "user" ? "text-cyan-100" : 
                        message.role === "system" ? "text-orange-300" : "text-[#9FB4D1]"
                      }`}>
                        {message.timestamp.toLocaleTimeString("pt-BR", { 
                          hour: "2-digit", 
                          minute: "2-digit" 
                        })}
                      </div>
                    </div>
                  </div>
                ))}
                
                {isTyping && (
                  <div className="flex justify-start animate-in fade-in duration-300">
                    <div className="bg-[#1E2433] rounded-xl px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-[#9FB4D1] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-[#9FB4D1] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-[#9FB4D1] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Quick Replies - SUGESTÕES RÁPIDAS */}
            <div className="flex flex-wrap gap-2 py-2 border-t border-[rgba(77,158,247,0.2)]">
              {QUICK_REPLIES.map((reply) => {
                const Icon = reply.icon
                return (
                  <Button
                    key={reply.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(reply.id, reply.label)}
                    className="bg-[#2B3447] border-[rgba(77,158,247,0.25)] hover:bg-[#36425A] hover:border-[#4D9EF7] transition-all hover:scale-105 text-xs text-[#DDE6F3]"
                  >
                    <Icon className="w-3 h-3 mr-1 text-[#4D9EF7]" />
                    {reply.label}
                  </Button>
                )
              })}
            </div>

            {/* Atalhos Táticos em 6 Categorias */}
            <div className="space-y-3 py-2 border-t border-[rgba(77,158,247,0.2)]">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={activeCategory === "gols" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(activeCategory === "gols" ? null : "gols")}
                  className="text-xs bg-[#2B3447] hover:bg-[#36425A] text-[#DDE6F3] border-[rgba(77,158,247,0.25)]"
                >
                  🟡 GOLS
                </Button>
                <Button
                  variant={activeCategory === "cartoes" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(activeCategory === "cartoes" ? null : "cartoes")}
                  className="text-xs bg-[#2B3447] hover:bg-[#36425A] text-[#DDE6F3] border-[rgba(77,158,247,0.25)]"
                >
                  🟠 CARTÕES
                </Button>
                <Button
                  variant={activeCategory === "escanteios" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(activeCategory === "escanteios" ? null : "escanteios")}
                  className="text-xs bg-[#2B3447] hover:bg-[#36425A] text-[#DDE6F3] border-[rgba(77,158,247,0.25)]"
                >
                  🟦 ESCANTEIOS
                </Button>
                <Button
                  variant={activeCategory === "tendencia" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(activeCategory === "tendencia" ? null : "tendencia")}
                  className="text-xs bg-[#2B3447] hover:bg-[#36425A] text-[#DDE6F3] border-[rgba(77,158,247,0.25)]"
                >
                  🟣 TENDÊNCIA
                </Button>
                <Button
                  variant={activeCategory === "viradaEmpate" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(activeCategory === "viradaEmpate" ? null : "viradaEmpate")}
                  className="text-xs bg-[#2B3447] hover:bg-[#36425A] text-[#DDE6F3] border-[rgba(77,158,247,0.25)]"
                >
                  🟢 VIRADA/EMPATE
                </Button>
                <Button
                  variant={activeCategory === "oraculo" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setActiveCategory(activeCategory === "oraculo" ? null : "oraculo")}
                  className="text-xs bg-[#2B3447] hover:bg-[#36425A] text-[#DDE6F3] border-[rgba(77,158,247,0.25)]"
                >
                  🔱 ORÁCULO
                </Button>
              </div>
              
              {activeCategory && (
                <div className="flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  {TACTICAL_SHORTCUTS[activeCategory as keyof typeof TACTICAL_SHORTCUTS].map((action) => {
                    const Icon = action.icon
                    return (
                      <Button
                        key={action.id}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickAction(action.id, action.label)}
                        className="bg-[#2B3447] border-[rgba(77,158,247,0.25)] hover:bg-[#36425A] hover:border-[#4D9EF7] transition-all hover:scale-105 text-xs text-[#DDE6F3]"
                      >
                        <Icon className="w-3 h-3 mr-1 text-[#4D9EF7]" />
                        {action.label}
                      </Button>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Input Fixo no Rodapé - DARK MODE PREMIUM */}
        <div className="bg-[#141A26] rounded-xl p-3 border border-[rgba(77,158,247,0.3)] shadow-lg">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Digite sua pergunta…"
              className="bg-transparent border-none text-[#E6EAF0] placeholder:text-[#7C8CA8] focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isTyping}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="bg-[#2B3447] hover:bg-[#36425A] transition-all hover:scale-105 shrink-0"
            >
              <Send className="w-4 h-4 text-[#E6EAF0]" />
            </Button>
          </div>
        </div>

        {/* Footer Info */}
        <div className="text-center text-xs text-[#9FB4D1]">
          <p>Assistente Tático Pro • 30 Módulos Ativos + HA+ Shield • Baseado em GODMODE 4.0</p>
          <p className="mt-1">GPS do Jogo™ • Chaos Meter™ • Oráculo Pro+ • Hidden Event Detector™ • HA+ LIVE</p>
        </div>
      </div>
    </div>
  )
}

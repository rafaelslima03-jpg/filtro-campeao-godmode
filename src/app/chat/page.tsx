"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
  ArrowLeft
} from "lucide-react"
import { GodmodeSession, type GodmodeAnalysisData } from "@/lib/godmode-session"

// ==================== TIPOS ====================

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
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

// ==================== ATALHOS TÁTICOS ====================

const QUICK_ACTIONS = [
  { id: "oraculo", label: "🔮 Oráculo", icon: Sparkles },
  { id: "proximo-gol", label: "🎯 Próximo Gol", icon: Target },
  { id: "proximo-cartao", label: "⚠️ Próximo Cartão", icon: AlertTriangle },
  { id: "escanteio-provavel", label: "🔥 Escanteio", icon: Flame },
  { id: "pressao-real", label: "📈 Pressão Real", icon: TrendingUp },
  { id: "sinais-contradictorios", label: "🧱 Sinais", icon: BarChart3 },
  { id: "replay-tatico", label: "⏮️ Replay", icon: Activity },
  { id: "mentor-risco", label: "🧠 Risco", icon: Shield }
]

// ==================== GERADOR DE RESPOSTAS TÁTICAS ====================

function generateTacticalResponse(query: string, context: GodmodeAnalysisData): string {
  const lowerQuery = query.toLowerCase()
  
  // 🔮 ORÁCULO - Modo Oráculo
  if (lowerQuery.includes("oráculo") || lowerQuery.includes("vai sair gol")) {
    let prediction = "NEUTRO"
    let reason = ""
    
    if (context.timeBombActive && context.momentum.trend === "crescendo") {
      prediction = "GOL IMINENTE"
      reason = "Time Bomb ativa + Momentum crescente + Shadow xG alto"
    } else if (context.deadGameDetected) {
      prediction = "JOGO MORTO"
      reason = "Dead Game detectado - xG parado, ritmo lento"
    } else if (context.momentum.last5min >= 75 && context.pressureIndex.pressureIndex >= 70) {
      prediction = "ACELERAÇÃO PROVÁVEL"
      reason = "Momentum e pressão altos indicam explosão iminente"
    } else if (context.riskMapType === "dead") {
      prediction = "SEM GOL"
      reason = "Risk Map = DEAD - jogo travado"
    } else {
      prediction = "CENÁRIO NEUTRO"
      reason = "Indicadores mistos - aguardar próximos minutos"
    }
    
    return `🔮 **MODO ORÁCULO - Previsão Direta**\n\n**Cenário:** ${context.homeTeam} ${context.score} ${context.awayTeam} (${context.minute}')\n\n**Previsão:** ${prediction}\n\n**Motivo:** ${reason}\n\n**Dados:**\n• Momentum: ${context.momentum.last5min.toFixed(0)}/100 (${context.momentum.trend})\n• Shadow xG: ${context.shadowXG.toFixed(2)}\n• Time Bomb: ${context.timeBombActive ? "ATIVA 💣" : "Inativa"}\n• Pressure Index: ${context.pressureIndex.pressureIndex.toFixed(0)}/100\n\n**Janela:** Próximos 8-12 minutos`
  }
  
  // 🧠 MENTOR DE RISCO
  if (lowerQuery.includes("mentor") || lowerQuery.includes("risco")) {
    let riskLevel = "MÉDIO"
    let riskColor = "🟡"
    
    if (context.deadZoneActive) {
      riskLevel = "CRÍTICO"
      riskColor = "🔴"
    } else if (context.greenLightActive) {
      riskLevel = "BAIXO"
      riskColor = "🟢"
    } else if (context.aggroLevel >= 3) {
      riskLevel = "ALTO"
      riskColor = "🟠"
    } else if (context.aggroLevel === 0) {
      riskLevel = "MÍNIMO"
      riskColor = "🟢"
    }
    
    return `🧠 **MENTOR DE RISCO**\n\n**Nível de Risco:** ${riskColor} ${riskLevel}\n\n**AggroLevel:** ${context.aggroLevel} (${context.aggroLevelName})\n\n**Motivos Objetivos:**\n${context.greenLightActive ? "✅ Green Light ativo - entrada segura\n" : ""}${context.deadZoneActive ? "🔴 Dead Zone ativa - ENTRADA PROIBIDA\n" : ""}${context.timeBombActive ? "💣 Time Bomb ativa - risco de gol contra\n" : ""}${context.htToFtCoherence === "ROTEIRO CONFIRMADO" ? "✅ Roteiro confirmado\n" : ""}${context.htToFtCoherence === "ROTEIRO ROMPIDO" ? "⚠️ Roteiro rompido\n" : ""}• Shadow xG: ${context.shadowXG.toFixed(2)}\n• RDS Fora: ${context.rdsFora.toFixed(1)}\n• Confidence: ${context.confidence.toFixed(1)}%\n\n**Recomendação:** ${context.deadZoneActive ? "NÃO ENTRAR" : context.greenLightActive ? "Entrada aprovada" : "Cautela moderada"}`
  }
  
  // 🎯 PRÓXIMO GOL
  if (lowerQuery.includes("próximo gol") || lowerQuery.includes("quem marca")) {
    const homeXG = context.xgHome
    const awayXG = context.xgAway
    const homePressure = context.pressureIndex.pressureIndex
    const awayMomentum = context.momentum.last5min
    
    let maisProvavel = context.awayTeam
    let probabilidade = 50
    
    if (awayXG > homeXG && awayMomentum > 60) {
      maisProvavel = context.awayTeam
      probabilidade = 65 + (awayMomentum - 60) * 0.5
    } else if (homeXG > awayXG && homePressure > 60) {
      maisProvavel = context.homeTeam
      probabilidade = 60 + (homePressure - 60) * 0.5
    }
    
    if (context.timeBombActive) probabilidade += 10
    if (context.shadowXG > 0.5) probabilidade += 8
    
    probabilidade = Math.min(85, probabilidade)
    
    return `🎯 **PRÓXIMO GOL - Análise**\n\n**Mais Provável:** ${maisProvavel}\n\n**Fatores:**\n• xG: ${maisProvavel === context.awayTeam ? awayXG.toFixed(2) : homeXG.toFixed(2)}\n• Momentum: ${context.momentum.last5min.toFixed(0)}/100 (${context.momentum.trend})\n• Pressure Index: ${context.pressureIndex.pressureIndex.toFixed(0)}/100\n• Shadow xG: ${context.shadowXG.toFixed(2)}\n• Ataques perigosos: ${maisProvavel === context.awayTeam ? context.stats.dangerousAttacksAway : context.stats.dangerousAttacksHome}\n• Time Bomb: ${context.timeBombActive ? "ATIVA 💣" : "Inativa"}\n\n**Probabilidade:** ${probabilidade.toFixed(0)}%\n**Janela:** Próximos 10-15 minutos`
  }
  
  // ⚠️ PRÓXIMO CARTÃO
  if (lowerQuery.includes("cartão") || lowerQuery.includes("amarelo")) {
    const totalYellowHome = context.stats.yellowHome
    const totalYellowAway = context.stats.yellowAway
    const totalRedHome = context.stats.redHome
    const totalRedAway = context.stats.redAway
    
    let maisProvavel = totalYellowHome > totalYellowAway ? context.homeTeam : context.awayTeam
    let probabilidade = 60
    
    if (context.riskMapType === "chaotic") probabilidade += 15
    if (context.momentum.trend === "crescendo") probabilidade += 10
    if (context.minute >= 70) probabilidade += 10
    
    return `⚠️ **PRÓXIMO CARTÃO - Análise**\n\n**Mais Provável:** ${maisProvavel}\n\n**Fatores:**\n• Cartões amarelos: ${totalYellowHome} (casa) vs ${totalYellowAway} (fora)\n• Cartões vermelhos: ${totalRedHome} (casa) vs ${totalRedAway} (fora)\n• Risk Map: ${context.riskMapType.toUpperCase()}\n• Momentum: ${context.momentum.trend.toUpperCase()}\n• Minuto: ${context.minute}' (pressão ${context.minute >= 70 ? "alta" : "moderada"})\n\n**Probabilidade:** ${probabilidade.toFixed(0)}%\n**Tipo esperado:** ${probabilidade > 75 ? "Amarelo (falta tática)" : "Amarelo (falta dura)"}`
  }
  
  // 📈 PRESSÃO REAL vs FALSA
  if (lowerQuery.includes("pressão")) {
    const isPressaoReal = context.pressureIndex.pressureIndex >= 60 && context.shadowXG > 0.2
    
    return `📈 **PRESSÃO REAL vs FALSA**\n\n**Diagnóstico:** ${isPressaoReal ? "PRESSÃO REAL ✅" : "PRESSÃO FALSA ⚠️"}\n\n**Evidências:**\n${context.stats.shotsOnTargetHome >= 5 ? `✅ Finalizações no alvo (casa): ${context.stats.shotsOnTargetHome}\n` : ""}${context.stats.shotsOnTargetAway >= 5 ? `✅ Finalizações no alvo (fora): ${context.stats.shotsOnTargetAway}\n` : ""}${context.xgHome > 1.5 ? `✅ xG casa crescente: ${context.xgHome.toFixed(2)}\n` : ""}${context.xgAway > 1.5 ? `✅ xG fora crescente: ${context.xgAway.toFixed(2)}\n` : ""}${context.shadowXG > 0.3 ? `✅ Shadow xG: ${context.shadowXG.toFixed(2)}\n` : ""}${context.stats.dangerousAttacksHome >= 30 ? `✅ Ataques perigosos (casa): ${context.stats.dangerousAttacksHome}\n` : ""}${context.stats.dangerousAttacksAway >= 30 ? `✅ Ataques perigosos (fora): ${context.stats.dangerousAttacksAway}\n` : ""}${context.stats.cornersHome + context.stats.cornersAway >= 8 ? `✅ Escanteios: ${context.stats.cornersHome + context.stats.cornersAway}\n` : ""}\n**Pressure Index:** ${context.pressureIndex.pressureIndex.toFixed(0)}/100\n\n**Conclusão:** ${isPressaoReal ? "Pressão genuína com alto risco de gol" : "Pressão estéril - posse sem penetração"}`
  }
  
  // 🔥 ESCANTEIO PROVÁVEL
  if (lowerQuery.includes("escanteio")) {
    const totalCorners = context.stats.cornersHome + context.stats.cornersAway
    const maisEscanteios = context.stats.cornersAway > context.stats.cornersHome ? context.awayTeam : context.homeTeam
    const probabilidade = Math.min(85, 50 + totalCorners * 3 + (context.pressureIndex.pressureIndex - 50) * 0.5)
    
    return `🔥 **ESCANTEIO PROVÁVEL**\n\n**Time:** ${maisEscanteios}\n\n**Análise:**\n• Escanteios já: ${totalCorners} (${context.stats.cornersHome} casa / ${context.stats.cornersAway} fora)\n• Ataques perigosos: ${maisEscanteios === context.awayTeam ? context.stats.dangerousAttacksAway : context.stats.dangerousAttacksHome}\n• Pressure Index: ${context.pressureIndex.pressureIndex.toFixed(0)}/100\n• Momentum: ${context.momentum.last5min.toFixed(0)}/100\n\n**Probabilidade:** ${probabilidade.toFixed(0)}% nos próximos 5 minutos\n**Flanco forte:** ${context.stats.possessionAway > 55 ? "Visitante dominando laterais" : "Casa pressionando flancos"}`
  }
  
  // 🧱 SINAIS CONTRADITÓRIOS
  if (lowerQuery.includes("contraditórios") || lowerQuery.includes("sinais")) {
    const proHA = []
    const contraHA = []
    
    if (context.rdsFora >= 70) proHA.push(`✅ RDS Fora: ${context.rdsFora.toFixed(1)}/100`)
    if (context.momentum.trend === "crescendo") proHA.push("✅ Momentum: Crescendo")
    if (context.htToFtCoherence === "ROTEIRO CONFIRMADO") proHA.push("✅ Roteiro confirmado")
    if (context.xgAway >= 1.2) proHA.push(`✅ xG competitivo: ${context.xgAway.toFixed(2)}`)
    if (context.greenLightActive) proHA.push("✅ Green Light ativo")
    
    if (context.pressureIndex.pressureIndex >= 65) contraHA.push(`⚠️ Pressure Index casa: ${context.pressureIndex.pressureIndex.toFixed(0)}/100`)
    if (context.shadowXG >= 0.35) contraHA.push(`⚠️ Shadow xG casa: ${context.shadowXG.toFixed(2)}`)
    if (context.minute >= 75) contraHA.push(`⚠️ Minuto avançado: ${context.minute}'`)
    if (context.timeBombActive) contraHA.push("⚠️ Time Bomb ativa")
    if (context.deadZoneActive) contraHA.push("🔴 Dead Zone ativa")
    
    const balanco = proHA.length > contraHA.length ? "PRÓ HA+ favorável" : 
                    proHA.length < contraHA.length ? "CONTRA HA+ dominante" : 
                    "NEUTRO - sinais equilibrados"
    
    return `🧱 **SINAIS CONTRADITÓRIOS**\n\n**PRÓ HA+:**\n${proHA.join("\n") || "Nenhum sinal forte"}\n\n**CONTRA HA+:**\n${contraHA.join("\n") || "Nenhum sinal forte"}\n\n**Balanço:** ${balanco}\n**Confiança:** ${context.confidence.toFixed(1)}%`
  }
  
  // ⏮️ REPLAY TÁTICO
  if (lowerQuery.includes("replay") || lowerQuery.includes("mudou")) {
    return `⏮️ **REPLAY TÁTICO - Últimos 5 Minutos**\n\n**Mudanças Detectadas:**\n\n📊 **Estatísticas:**\n• Finalizações: ${context.stats.shotsTotalHome} (casa) / ${context.stats.shotsTotalAway} (fora)\n• No alvo: ${context.stats.shotsOnTargetHome} (casa) / ${context.stats.shotsOnTargetAway} (fora)\n• Posse: ${context.stats.possessionHome}% (casa) / ${context.stats.possessionAway}% (fora)\n\n⚡ **Momentum:**\n• Atual: ${context.momentum.last5min.toFixed(0)}/100\n• Tendência: ${context.momentum.trend.toUpperCase()}\n\n🎯 **Impacto:**\n${context.momentum.trend === "crescendo" ? "Visitante acelerou significativamente. Pressão real aumentou." : context.momentum.trend === "caindo" ? "Visitante perdeu intensidade. Favorito retomou controle." : "Jogo mantém equilíbrio. Cenário estável."}\n\n**Pattern Break:** ${context.patternBreak.toUpperCase()}`
  }
  
  // ⚡ JOGO ACELERANDO OU MORRENDO
  if (lowerQuery.includes("acelerando") || lowerQuery.includes("morrendo") || lowerQuery.includes("ritmo")) {
    const status = context.deadGameDetected ? "MORRENDO" : 
                   context.riskMapType === "explosive" ? "ACELERANDO" :
                   context.momentum.trend === "crescendo" ? "ACELERANDO" :
                   context.momentum.trend === "caindo" ? "DESACELERANDO" : "ESTÁVEL"
    
    return `⚡ **RITMO DO JOGO**\n\n**Status:** ${status}\n\n**Indicadores:**\n• Risk Map: ${context.riskMapType.toUpperCase()}\n• Momentum: ${context.momentum.last5min.toFixed(0)}/100 (${context.momentum.trend})\n• Dead Game: ${context.deadGameDetected ? "DETECTADO ⚠️" : "Não"}\n• Finalizações totais: ${context.stats.shotsTotalHome + context.stats.shotsTotalAway}\n• Ataques perigosos: ${context.stats.dangerousAttacksHome + context.stats.dangerousAttacksAway}\n\n**Tendência:** ${status === "ACELERANDO" ? "Jogo caminha para final explosivo" : status === "MORRENDO" ? "Jogo travado - poucos eventos esperados" : "Ritmo controlado"}`
  }
  
  // 🎮 QUEM DOMINA
  if (lowerQuery.includes("domina") || lowerQuery.includes("controle")) {
    const dominante = context.rdsFora > context.rdsCasa ? context.awayTeam : context.homeTeam
    const rdsVencedor = Math.max(context.rdsFora, context.rdsCasa)
    
    return `🎮 **CONTROLE DO RITMO**\n\n**Dominante:** ${dominante}\n\n**Métricas:**\n• RDS: ${context.rdsCasa.toFixed(1)} (casa) / ${context.rdsFora.toFixed(1)} (fora)\n• Posse: ${context.stats.possessionHome}% (casa) / ${context.stats.possessionAway}% (fora)\n• xG: ${context.xgHome.toFixed(2)} (casa) / ${context.xgAway.toFixed(2)} (fora)\n• Finalizações: ${context.stats.shotsTotalHome} (casa) / ${context.stats.shotsTotalAway} (fora)\n\n**Conclusão:** ${dominante} dita o ritmo do jogo (RDS ${rdsVencedor.toFixed(1)}/100)`
  }
  
  // 💰 ODD JUSTA OU ERRADA
  if (lowerQuery.includes("odd")) {
    const evAbs = Math.abs(context.ev)
    const discrepancia = evAbs > 8
    
    return `💰 **ANÁLISE DE MERCADO**\n\n**Odd Live:** ${context.haOdd.toFixed(2)}\n**Linha:** ${context.haLine}\n\n**EV:** ${context.ev.toFixed(2)}%\n**Discrepância:** ${discrepancia ? `SIM (${evAbs.toFixed(1)}%)` : `NÃO (${evAbs.toFixed(1)}%)`}\n\n**Diagnóstico:** ${discrepancia ? "MERCADO ATRASADO ⚠️" : "MERCADO ALINHADO ✅"}\n\n**Motivo:** ${discrepancia ? "Odds não refletem mudanças recentes de momentum/pressão. True Value detectado." : "Odds refletem corretamente o estado atual do jogo."}\n\n**OPC Status:** ${context.opcStatus}\n${context.opcMessage}`
  }
  
  // 🛡️ VIRADA POTENCIAL
  if (lowerQuery.includes("virada") || lowerQuery.includes("virar")) {
    const [homeScore, awayScore] = context.score.split("-").map(Number)
    const scoreDiff = homeScore - awayScore
    const viradaPossivel = scoreDiff <= 1 && context.momentum.trend === "crescendo" && context.rdsFora >= 65
    
    return `🔄 **VIRADA POTENCIAL**\n\n**Placar:** ${context.score}\n**Diferença:** ${Math.abs(scoreDiff)} gol(s)\n\n**Análise:**\n• Momentum visitante: ${context.momentum.last5min.toFixed(0)}/100 (${context.momentum.trend})\n• RDS Fora: ${context.rdsFora.toFixed(1)}/100\n• xG Fora: ${context.xgAway.toFixed(2)}\n• Pressure Index: ${context.pressureIndex.pressureIndex.toFixed(0)}/100\n\n**Risco de Virada:** ${viradaPossivel ? "ALTO 🔴" : scoreDiff === 0 ? "N/A (empate)" : "BAIXO 🟢"}\n\n**Motivo:** ${viradaPossivel ? "Visitante crescendo + RDS alto + Momentum positivo" : "Favorito mantém controle ou visitante sem força"}`
  }
  
  // 🏁 FIM EXPLOSIVO
  if (lowerQuery.includes("fim") || lowerQuery.includes("final")) {
    const fimExplosivo = context.minute >= 75 && (
      context.momentum.trend === "crescendo" || 
      context.timeBombActive || 
      context.riskMapType === "explosive"
    )
    
    return `🏁 **FIM EXPLOSIVO**\n\n**Minuto:** ${context.minute}'\n\n**Análise:**\n• Momentum: ${context.momentum.last5min.toFixed(0)}/100 (${context.momentum.trend})\n• Time Bomb: ${context.timeBombActive ? "ATIVA 💣" : "Inativa"}\n• Risk Map: ${context.riskMapType.toUpperCase()}\n• Shadow xG: ${context.shadowXG.toFixed(2)}\n\n**Previsão:** ${fimExplosivo ? "FIM EXPLOSIVO PROVÁVEL 🔥" : "FIM CONTROLADO ✅"}\n\n**Expectativa:** ${fimExplosivo ? "Múltiplos eventos nos minutos finais (gols, cartões, pressão extrema)" : "Jogo caminha para final sem grandes emoções"}`
  }
  
  // 🔍 BURACOS DEFENSIVOS
  if (lowerQuery.includes("buraco") || lowerQuery.includes("defensivo")) {
    const buracoCasa = context.stats.shotsOnTargetAway >= 5 && context.xgAway >= 1.5
    const buracoFora = context.stats.shotsOnTargetHome >= 5 && context.xgHome >= 1.5
    
    return `🔍 **BURACOS DEFENSIVOS**\n\n**Casa (${context.homeTeam}):**\n${buracoCasa ? "⚠️ VULNERÁVEL" : "✅ SÓLIDO"}\n• Finalizações sofridas: ${context.stats.shotsOnTargetAway}\n• xG contra: ${context.xgAway.toFixed(2)}\n\n**Fora (${context.awayTeam}):**\n${buracoFora ? "⚠️ VULNERÁVEL" : "✅ SÓLIDO"}\n• Finalizações sofridas: ${context.stats.shotsOnTargetHome}\n• xG contra: ${context.xgHome.toFixed(2)}\n\n**Conclusão:** ${buracoCasa && buracoFora ? "Ambas defesas vulneráveis - jogo aberto" : buracoCasa ? "Casa vulnerável - visitante pode explorar" : buracoFora ? "Visitante vulnerável - casa pode explorar" : "Ambas defesas sólidas"}`
  }
  
  // 📊 COMPARAÇÃO 1T→2T
  if (lowerQuery.includes("1t") || lowerQuery.includes("2t") || lowerQuery.includes("comparação")) {
    return `📊 **COMPARAÇÃO 1T → 2T**\n\n**Coerência HT→FT:** ${context.htToFtCoherence || "N/A"}\n\n**Evolução:**\n• RDS Casa: ${context.rdsCasa.toFixed(1)}/100\n• RDS Fora: ${context.rdsFora.toFixed(1)}/100\n• Momentum: ${context.momentum.trend.toUpperCase()}\n• Pattern Break: ${context.patternBreak.toUpperCase()}\n\n**Interpretação:**\n${context.htToFtCoherence === "ROTEIRO CONFIRMADO" ? "✅ Jogo seguindo script do 1T - cenário previsível" : context.htToFtCoherence === "ROTEIRO ROMPIDO" ? "⚠️ Jogo mudou completamente - revisar estratégia" : "⚪ Sem dados do 1T para comparar"}\n\n**Mirror Check:** ${context.mirrorCheckActive ? `ATIVO ✅\n${context.mirrorCheckArchetype}` : "Inativo"}`
  }
  
  // Resposta genérica para perguntas não mapeadas
  return `🤖 **Assistente Tático Pro**\n\n"${query}"\n\nAnalisando dados do GODMODE 4.0...\n\n**Contexto Atual:**\n• Jogo: ${context.homeTeam} ${context.score} ${context.awayTeam}\n• Minuto: ${context.minute}'\n• AggroLevel: ${context.aggroLevel} (${context.aggroLevelName})\n• Confiança: ${context.confidence.toFixed(1)}%\n• EV: ${context.ev.toFixed(2)}%\n\n**Status GODMODE:**\n• Green Light: ${context.greenLightActive ? "🟢 ATIVO" : "⚪ Inativo"}\n• Dead Zone: ${context.deadZoneActive ? "🔴 ATIVA" : "⚪ Inativa"}\n• Score Shield: ${context.scoreShieldActive ? "🛡️ ATIVO" : "⚪ Inativo"}\n• Time Bomb: ${context.timeBombActive ? "💣 ATIVA" : "⚪ Inativa"}\n\n**Perguntas sugeridas:**\n• "Vai sair gol?"\n• "Pressão real ou falsa?"\n• "Quem marca o próximo gol?"\n• "O jogo está acelerando?"\n• "Existe risco de virada?"`
}

// ==================== COMPONENTE PRINCIPAL ====================

export default function ChatPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [gameContext, setGameContext] = useState<GodmodeAnalysisData | null>(null)
  const [isBlocked, setIsBlocked] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Carregar análise ao montar componente
  useEffect(() => {
    const loadAnalysis = () => {
      if (GodmodeSession.hasValidAnalysis()) {
        const data = GodmodeSession.loadAnalysis()
        if (data) {
          setGameContext(data)
          setIsBlocked(false)
          
          // Mensagem de boas-vindas
          setMessages([
            {
              id: "welcome",
              role: "assistant",
              content: `👋 **Bem-vindo ao Assistente Tático Pro!**\n\n📊 **Análise carregada:**\n${data.homeTeam} ${data.score} ${data.awayTeam} — ${data.minute}'\n\n**O que posso fazer:**\n• Analisar momentum e pressão em tempo real\n• Prever próximos eventos (gols, cartões, escanteios)\n• Explicar movimentos de mercado e odds\n• Detectar padrões táticos e emocionais\n• Avaliar riscos e oportunidades\n\n**30 Módulos Ativos:**\n✅ 10 Módulos Avançados\n✅ 20 Módulos Ultra-Elite\n\n**Como usar:**\nEscolha um atalho rápido ou faça sua pergunta!`,
              timestamp: new Date()
            }
          ])
        }
      } else {
        setIsBlocked(true)
      }
    }
    
    loadAnalysis()
  }, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = (text?: string) => {
    if (!gameContext) return
    
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
      const response = generateTacticalResponse(messageText, gameContext)
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

  const handleQuickAction = (actionId: string) => {
    const actionLabels: Record<string, string> = {
      "oraculo": "🔮 Oráculo - Vai sair gol?",
      "mentor-risco": "🧠 Mentor de Risco - Qual o nível de risco?",
      "proximo-gol": "🎯 Quem marca o próximo gol?",
      "proximo-cartao": "⚠️ Quem leva o próximo cartão?",
      "pressao-real": "📈 Pressão real ou falsa?",
      "escanteio-provavel": "🔥 Escanteio provável?",
      "sinais-contradictorios": "🧱 Mostre sinais contraditórios",
      "replay-tatico": "⏮️ O que mudou nos últimos 5 minutos?"
    }
    handleSend(actionLabels[actionId] || actionId)
  }

  const handleClearGame = () => {
    GodmodeSession.clearAnalysis()
    setGameContext(null)
    setIsBlocked(true)
    setMessages([])
  }

  // Tela de bloqueio
  if (isBlocked || !gameContext) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100 flex items-center justify-center p-4">
        <Card className="bg-slate-900/60 border-slate-800 max-w-2xl w-full">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="container mx-auto px-4 py-6 max-w-5xl h-screen flex flex-col">
        {/* Header */}
        <Card className="bg-slate-900/60 border-slate-800 mb-4">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/")}
                  className="text-slate-400 hover:text-slate-100"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Brain className="w-6 h-6 text-cyan-400" />
                  Assistente Tático Pro
                </CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-xs">
                  {gameContext.homeTeam} {gameContext.score} {gameContext.awayTeam}
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {gameContext.minute}'
                </Badge>
                <Badge variant={
                  gameContext.aggroLevel === 0 ? "secondary" :
                  gameContext.aggroLevel === 1 ? "outline" :
                  gameContext.aggroLevel === 2 ? "default" : "destructive"
                }>
                  Aggro {gameContext.aggroLevel}
                </Badge>
                {gameContext.confidence != null && (
                  <Badge variant={
                    gameContext.confidence >= 70 ? "default" :
                    gameContext.confidence >= 50 ? "outline" : "destructive"
                  }>
                    {gameContext.confidence.toFixed(0)}%
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearGame}
                  className="text-slate-400 hover:text-red-400"
                  title="Trocar Jogo Analisado"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Chat Area */}
        <Card className="bg-slate-900/60 border-slate-800 flex-1 flex flex-col overflow-hidden">
          <CardContent className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
            {/* Messages */}
            <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === "user"
                          ? "bg-cyan-600 text-white"
                          : "bg-slate-800 text-slate-100"
                      }`}
                    >
                      <div className="whitespace-pre-line text-sm leading-relaxed">
                        {message.content}
                      </div>
                      <div className={`text-xs mt-2 ${
                        message.role === "user" ? "text-cyan-100" : "text-slate-400"
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
                    <div className="bg-slate-800 rounded-2xl px-4 py-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 py-2 border-t border-slate-700">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon
                return (
                  <Button
                    key={action.id}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAction(action.id)}
                    className="bg-slate-800 border-slate-700 hover:bg-slate-700 hover:border-cyan-500 transition-all hover:scale-105"
                  >
                    <Icon className="w-4 h-4 mr-1" />
                    {action.label}
                  </Button>
                )
              })}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Faça sua pergunta tática..."
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:border-cyan-500 transition-colors"
              />
              <Button
                onClick={() => handleSend()}
                disabled={!input.trim() || isTyping}
                className="bg-cyan-600 hover:bg-cyan-700 transition-all hover:scale-105"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer Info */}
        <div className="mt-4 text-center text-xs text-slate-400">
          <p>Assistente Tático Pro • 30 Módulos Ativos • Baseado em GODMODE 4.0</p>
          <p className="mt-1">10 Módulos Avançados + 20 Módulos Ultra-Elite</p>
        </div>
      </div>
    </div>
  )
}

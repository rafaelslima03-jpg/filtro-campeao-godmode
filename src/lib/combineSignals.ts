// ==================== COMBINAÇÃO DE SINAIS PRÉ-JOGO + HT ====================

interface PreGameAnalysis {
  recommendation: string
  handicap: string
  confidence: number
  ev: number
  oddBugada?: boolean
  redFlags: Array<{ type: string; message: string }>
}

interface HTAnalysis {
  recommendation: string
  handicap: string
  haLine?: string
  confidence: number
  ev: number
  pressureIndex?: number
  oddBugada?: boolean
  redFlags: Array<{ type: string; message: string }>
}

interface CombinedSignals {
  finalRecommendation: string
  finalHandicap: string
  finalConfidence: number
  finalEV: number
  notes: string[]
  coherence: "ALTA" | "MÉDIA" | "BAIXA"
  shouldBet: boolean
}

/**
 * Combina sinais do pré-jogo com análise do HT
 * 
 * Lógica:
 * - Se ambos recomendam apostar: ALTA coerência, aumenta confiança
 * - Se pré-jogo recomenda mas HT não: BAIXA coerência, veto
 * - Se pré-jogo não recomenda mas HT sim: MÉDIA coerência, cautela
 * - Se ambos não recomendam: ALTA coerência no veto
 */
export function combinePreAndHtSignals(
  preAnalysis: PreGameAnalysis,
  htAnalysis: HTAnalysis
): CombinedSignals {
  const notes: string[] = []
  
  const preRecommends = !preAnalysis.recommendation.includes("NÃO APOSTAR")
  const htRecommends = !htAnalysis.recommendation.includes("NÃO APOSTAR")
  
  notes.push("=== ANÁLISE PRÉ-JOGO ===")
  notes.push(`Recomendação: ${preAnalysis.recommendation}`)
  notes.push(`Confiança: ${preAnalysis.confidence.toFixed(1)}%`)
  notes.push(`EV: ${preAnalysis.ev.toFixed(2)}%`)
  if (preAnalysis.oddBugada) {
    notes.push("⚠️ Odd bugada detectada no pré-jogo")
  }
  
  notes.push("")
  notes.push("=== ANÁLISE HT → FT ===")
  notes.push(`Recomendação: ${htAnalysis.recommendation}`)
  notes.push(`Confiança: ${htAnalysis.confidence.toFixed(1)}%`)
  notes.push(`EV: ${htAnalysis.ev.toFixed(2)}%`)
  if (htAnalysis.pressureIndex !== undefined) {
    notes.push(`Índice de Pressão: ${htAnalysis.pressureIndex}/100`)
  }
  if (htAnalysis.oddBugada) {
    notes.push("⚠️ Odd bugada detectada no HT")
  }
  
  notes.push("")
  notes.push("=== COERÊNCIA DOS SINAIS ===")
  
  // CENÁRIO 1: Ambos recomendam apostar
  if (preRecommends && htRecommends) {
    notes.push("✅ ALTA COERÊNCIA: Pré-jogo e HT convergem para APOSTAR")
    
    // Verificar se handicaps são compatíveis
    const preHaValue = parseFloat(preAnalysis.handicap.replace("+", ""))
    const htHaValue = htAnalysis.haLine ? parseFloat(htAnalysis.haLine.replace("+", "")) : 0
    
    if (Math.abs(preHaValue - htHaValue) <= 0.5) {
      notes.push("✅ Handicaps compatíveis - sinais alinhados")
    } else {
      notes.push("⚠️ Handicaps diferentes - ajustar para o mais conservador")
    }
    
    // Confiança combinada (média ponderada: 40% pré, 60% HT)
    const finalConfidence = preAnalysis.confidence * 0.4 + htAnalysis.confidence * 0.6
    
    // EV combinado (média ponderada: 40% pré, 60% HT)
    const finalEV = preAnalysis.ev * 0.4 + htAnalysis.ev * 0.6
    
    // Usar handicap do HT (mais atualizado)
    const finalHandicap = htAnalysis.haLine || htAnalysis.handicap
    
    notes.push(`Confiança combinada: ${finalConfidence.toFixed(1)}%`)
    notes.push(`EV combinado: ${finalEV.toFixed(2)}%`)
    notes.push(`Handicap final: ${finalHandicap}`)
    
    return {
      finalRecommendation: `APOSTAR: ${finalHandicap} (Sinais convergentes)`,
      finalHandicap,
      finalConfidence,
      finalEV,
      notes,
      coherence: "ALTA",
      shouldBet: true
    }
  }
  
  // CENÁRIO 2: Pré-jogo recomenda, mas HT não
  if (preRecommends && !htRecommends) {
    notes.push("⚠️ BAIXA COERÊNCIA: Pré-jogo recomendava, mas HT vetou")
    notes.push("Possíveis razões:")
    notes.push("- Jogo não se desenvolveu como esperado")
    notes.push("- Red flags surgiram no 1º tempo")
    notes.push("- Pressão ofensiva insuficiente")
    notes.push("")
    notes.push("🛡️ DECISÃO: NÃO APOSTAR (veto do HT prevalece)")
    
    return {
      finalRecommendation: "NÃO APOSTAR - HT vetou aposta do pré-jogo",
      finalHandicap: "N/A",
      finalConfidence: htAnalysis.confidence,
      finalEV: htAnalysis.ev,
      notes,
      coherence: "BAIXA",
      shouldBet: false
    }
  }
  
  // CENÁRIO 3: Pré-jogo não recomenda, mas HT sim
  if (!preRecommends && htRecommends) {
    notes.push("⚠️ MÉDIA COERÊNCIA: Pré-jogo não recomendava, mas HT identificou oportunidade")
    notes.push("Possíveis razões:")
    notes.push("- Jogo se desenvolveu melhor que o esperado")
    notes.push("- Time mostrou mais força no 1º tempo")
    notes.push("- Odds do HT mais favoráveis")
    notes.push("")
    
    // Verificar se HT tem confiança alta o suficiente para sobrepor pré-jogo
    if (htAnalysis.confidence >= 70 && htAnalysis.ev > 3) {
      notes.push("✅ HT com confiança alta - oportunidade válida")
      notes.push("🎯 DECISÃO: APOSTAR com cautela (baseado no HT)")
      
      return {
        finalRecommendation: `APOSTAR: ${htAnalysis.haLine || htAnalysis.handicap} (Oportunidade no HT)`,
        finalHandicap: htAnalysis.haLine || htAnalysis.handicap,
        finalConfidence: htAnalysis.confidence * 0.85, // Reduzir 15% por falta de convergência
        finalEV: htAnalysis.ev * 0.85,
        notes,
        coherence: "MÉDIA",
        shouldBet: true
      }
    } else {
      notes.push("⚠️ HT sem confiança suficiente para sobrepor pré-jogo")
      notes.push("🛡️ DECISÃO: NÃO APOSTAR (cautela)")
      
      return {
        finalRecommendation: "NÃO APOSTAR - Sinais divergentes sem confiança suficiente",
        finalHandicap: "N/A",
        finalConfidence: htAnalysis.confidence,
        finalEV: htAnalysis.ev,
        notes,
        coherence: "MÉDIA",
        shouldBet: false
      }
    }
  }
  
  // CENÁRIO 4: Ambos não recomendam
  notes.push("✅ ALTA COERÊNCIA: Pré-jogo e HT convergem para NÃO APOSTAR")
  notes.push("Sistema identificou que não há edge matemático")
  notes.push("🛡️ DECISÃO: NÃO APOSTAR (sinais convergentes)")
  
  return {
    finalRecommendation: "NÃO APOSTAR - Sinais convergentes (sem edge)",
    finalHandicap: "N/A",
    finalConfidence: Math.min(preAnalysis.confidence, htAnalysis.confidence),
    finalEV: Math.min(preAnalysis.ev, htAnalysis.ev),
    notes,
    coherence: "ALTA",
    shouldBet: false
  }
}

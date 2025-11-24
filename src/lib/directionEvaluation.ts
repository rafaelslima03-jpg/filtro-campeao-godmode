// ==================== AVALIAÇÃO DE DIREÇÃO (PÓS-JOGO) ====================

interface HTAnalysis {
  teamName: string
  haLine: string
  recommendation: string
}

interface FullTimeData {
  finalScore: string // Ex: "2-1"
  shots: {
    home: number
    away: number
  }
  dangerousAttacks: {
    home: number
    away: number
  }
}

export type DirectionResult = "CORRETA" | "ERRADA" | "VARIANCIA"

/**
 * Avalia se a "direção" do filtro bateu no pós-jogo
 * 
 * CORRETA: HA+ cobriu (time não perdeu por margem maior que a linha)
 * ERRADA: HA+ não cobriu (time perdeu por margem maior que a linha)
 * VARIANCIA: Resultado dentro da variância estatística esperada
 */
export function evaluateDirectionForHaPlus(
  htAnalysis: HTAnalysis,
  fullTimeData: FullTimeData
): {
  result: DirectionResult
  message: string
  details: string[]
} {
  const details: string[] = []
  
  // Parse do placar final
  const [homeScore, awayScore] = fullTimeData.finalScore.split("-").map(Number)
  const scoreDiff = homeScore - awayScore
  
  // Parse da linha HA+
  const lineValue = parseFloat(htAnalysis.haLine.replace("+", ""))
  
  details.push(`Placar final: ${fullTimeData.finalScore}`)
  details.push(`Linha HA+: ${htAnalysis.haLine}`)
  details.push(`Diferença de gols: ${scoreDiff > 0 ? "+" : ""}${scoreDiff}`)
  
  // Se o sistema recomendou NÃO APOSTAR
  if (htAnalysis.recommendation.includes("NÃO APOSTAR")) {
    details.push("Sistema recomendou NÃO APOSTAR - avaliação de direção não aplicável")
    return {
      result: "VARIANCIA",
      message: "Sistema vetou a aposta - direção não avaliada",
      details
    }
  }
  
  // Lógica de cobertura do HA+
  // HA+ cobre se: (gols do time + linha) >= gols do adversário
  // Ou seja: time não pode perder por margem maior que a linha
  
  // Para o visitante (underdog):
  // HA +0.5: cobre se não perder por 1 ou mais
  // HA +1.0: cobre se não perder por 2 ou mais
  // HA +1.5: cobre se não perder por 2 ou mais
  
  let covered = false
  
  if (lineValue === 0.25) {
    // +0.25: metade na vitória/empate, metade no +0.5
    if (scoreDiff <= 0) {
      covered = true
      details.push("HA +0.25 cobriu: time não perdeu")
    } else if (scoreDiff === 1) {
      details.push("HA +0.25 cobriu parcialmente: perdeu por 1 (metade do stake)")
      return {
        result: "VARIANCIA",
        message: "Cobertura parcial (metade do stake) - dentro da variância",
        details
      }
    }
  } else if (lineValue === 0.5) {
    // +0.5: cobre se não perder
    if (scoreDiff <= 0) {
      covered = true
      details.push("HA +0.5 cobriu: time não perdeu")
    }
  } else if (lineValue === 0.75) {
    // +0.75: metade no +0.5, metade no +1.0
    if (scoreDiff <= 0) {
      covered = true
      details.push("HA +0.75 cobriu: time não perdeu")
    } else if (scoreDiff === 1) {
      details.push("HA +0.75 cobriu parcialmente: perdeu por 1 (metade do stake)")
      return {
        result: "VARIANCIA",
        message: "Cobertura parcial (metade do stake) - dentro da variância",
        details
      }
    }
  } else if (lineValue === 1.0) {
    // +1.0: cobre se não perder por 2 ou mais
    if (scoreDiff <= 1) {
      covered = true
      details.push("HA +1.0 cobriu: time não perdeu por 2 ou mais")
    }
  } else if (lineValue === 1.25) {
    // +1.25: metade no +1.0, metade no +1.5
    if (scoreDiff <= 1) {
      covered = true
      details.push("HA +1.25 cobriu: time não perdeu por 2 ou mais")
    } else if (scoreDiff === 2) {
      details.push("HA +1.25 cobriu parcialmente: perdeu por 2 (metade do stake)")
      return {
        result: "VARIANCIA",
        message: "Cobertura parcial (metade do stake) - dentro da variância",
        details
      }
    }
  } else if (lineValue === 1.5) {
    // +1.5: cobre se não perder por 2 ou mais
    if (scoreDiff <= 1) {
      covered = true
      details.push("HA +1.5 cobriu: time não perdeu por 2 ou mais")
    }
  } else if (lineValue === 1.75) {
    // +1.75: metade no +1.5, metade no +2.0
    if (scoreDiff <= 1) {
      covered = true
      details.push("HA +1.75 cobriu: time não perdeu por 2 ou mais")
    } else if (scoreDiff === 2) {
      details.push("HA +1.75 cobriu parcialmente: perdeu por 2 (metade do stake)")
      return {
        result: "VARIANCIA",
        message: "Cobertura parcial (metade do stake) - dentro da variância",
        details
      }
    }
  } else if (lineValue === 2.0) {
    // +2.0: cobre se não perder por 3 ou mais
    if (scoreDiff <= 2) {
      covered = true
      details.push("HA +2.0 cobriu: time não perdeu por 3 ou mais")
    }
  }
  
  // Análise de estatísticas para contexto
  const totalShots = fullTimeData.shots.home + fullTimeData.shots.away
  const awayShots = fullTimeData.shots.away
  const shotsProportion = totalShots > 0 ? (awayShots / totalShots) * 100 : 0
  
  details.push(`Finalizações: ${fullTimeData.shots.home} x ${fullTimeData.shots.away}`)
  details.push(`Proporção visitante: ${shotsProportion.toFixed(1)}%`)
  details.push(`Ataques perigosos: ${fullTimeData.dangerousAttacks.home} x ${fullTimeData.dangerousAttacks.away}`)
  
  if (covered) {
    // Direção CORRETA
    return {
      result: "CORRETA",
      message: `✅ Direção CORRETA - HA+ ${htAnalysis.haLine} cobriu`,
      details
    }
  } else {
    // Direção ERRADA
    // Mas verificar se foi por variância estatística (jogo equilibrado mas resultado adverso)
    if (shotsProportion >= 40 && scoreDiff <= 2) {
      details.push("Jogo foi equilibrado estatisticamente - resultado dentro da variância esperada")
      return {
        result: "VARIANCIA",
        message: "Resultado adverso mas dentro da variância estatística",
        details
      }
    }
    
    return {
      result: "ERRADA",
      message: `❌ Direção ERRADA - HA+ ${htAnalysis.haLine} não cobriu`,
      details
    }
  }
}

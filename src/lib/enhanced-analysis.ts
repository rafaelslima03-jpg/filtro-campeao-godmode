/**
 * Módulo de análise enriquecida com dados da API-Football
 * Processa standings, h2h, events, lineups, injuries, topscorers, odds, predictions
 */

export interface EnhancedData {
  standings: any[]
  h2h: any[]
  events: any[]
  lineups: any[]
  injuries: any[]
  topscorers: any[]
  odds: any[]
  predictions: any
}

export interface RedFlag {
  type: "CRÍTICA" | "MODERADA"
  message: string
  source: string
}

export interface CriteriaAdjustment {
  criteriaId: number
  adjustment: number
  reason: string
}

/**
 * Detecta Red Flags baseado em dados enriquecidos
 */
export function detectarRedFlags(
  htStats: any,
  events: any[],
  lineups: any[],
  injuries: any[],
  standings: any[]
): RedFlag[] {
  const flags: RedFlag[] = []

  // 1. RED FLAG: Expulsão
  const redCards = events.filter(e => e.type === "Card" && e.detail === "Red Card")
  if (redCards.length > 0) {
    flags.push({
      type: "CRÍTICA",
      message: `Expulsão detectada: ${redCards.map(r => r.player?.name || "Jogador").join(", ")}`,
      source: "events"
    })
  }

  // 2. RED FLAG: Pênalti cedo (distorce xG)
  const earlyPenalties = events.filter(
    e => e.type === "Goal" && e.detail === "Penalty" && parseInt(e.time?.elapsed || "999") < 30
  )
  if (earlyPenalties.length > 0) {
    flags.push({
      type: "MODERADA",
      message: "Pênalti antes dos 30 min - xG pode estar distorcido",
      source: "events"
    })
  }

  // 3. RED FLAG: Linha defensiva reserva
  if (lineups.length > 0) {
    const awayLineup = lineups.find(l => l.team?.id !== lineups[0]?.team?.id) || lineups[1]
    const defenders = awayLineup?.startXI?.filter((p: any) => 
      p.player?.pos === "D" || p.player?.grid?.startsWith("4-")
    ) || []
    
    // Verificar se há muitos reservas na defesa (simplificado)
    if (defenders.length < 3) {
      flags.push({
        type: "MODERADA",
        message: "Possível linha defensiva desfalcada ou reserva",
        source: "lineups"
      })
    }
  }

  // 4. RED FLAG: Goleiro titular fora
  const goalkeeperInjuries = injuries.filter(
    i => i.player?.pos === "Goalkeeper" && i.player?.reason
  )
  if (goalkeeperInjuries.length > 0) {
    flags.push({
      type: "CRÍTICA",
      message: `Goleiro lesionado: ${goalkeeperInjuries.map(i => i.player?.name).join(", ")}`,
      source: "injuries"
    })
  }

  // 5. RED FLAG: Time desmotivado (zona morta da tabela)
  if (standings.length > 0) {
    const totalTeams = standings.length
    const midStart = Math.floor(totalTeams * 0.4)
    const midEnd = Math.floor(totalTeams * 0.6)
    
    // Verificar se time está na "zona morta" (meio da tabela sem objetivos)
    const teamPosition = standings.findIndex(s => s.team?.id === htStats?.awayTeamId)
    if (teamPosition >= midStart && teamPosition <= midEnd) {
      const team = standings[teamPosition]
      // Se não está brigando por nada (nem título, nem vaga, nem rebaixamento)
      if (teamPosition > 6 && teamPosition < totalTeams - 6) {
        flags.push({
          type: "MODERADA",
          message: `Time na zona morta da tabela (${teamPosition + 1}º lugar) - possível desmotivação`,
          source: "standings"
        })
      }
    }
  }

  // 6. RED FLAG: Jogo frenético (15+ finalizações antes dos 30 min)
  if (htStats) {
    const totalShots = (htStats.shotsTotalHome || 0) + (htStats.shotsTotalAway || 0)
    if (totalShots >= 15) {
      flags.push({
        type: "MODERADA",
        message: `Jogo muito frenético (${totalShots} finalizações no 1º tempo) - imprevisível`,
        source: "htStats"
      })
    }
  }

  // 7. RED FLAG: Cartões amarelos críticos em zagueiros
  const yellowCardsDefenders = events.filter(
    e => e.type === "Card" && 
    e.detail === "Yellow Card" && 
    (e.player?.pos === "D" || e.comments?.toLowerCase().includes("defender"))
  )
  if (yellowCardsDefenders.length >= 2) {
    flags.push({
      type: "MODERADA",
      message: `${yellowCardsDefenders.length} zagueiros com cartão amarelo - risco de expulsão`,
      source: "events"
    })
  }

  // 8. RED FLAG: Jogo sem posse definida (caos)
  if (htStats && htStats.possessionHome && htStats.possessionAway) {
    if (htStats.possessionHome < 45 && htStats.possessionAway < 45) {
      flags.push({
        type: "MODERADA",
        message: "Jogo caótico - nenhum time domina a posse (ambos <45%)",
        source: "htStats"
      })
    }
  }

  // 9. RED FLAG: Atacante titular ausente
  const attackerInjuries = injuries.filter(
    i => (i.player?.pos === "Attacker" || i.player?.pos === "Forward") && i.player?.reason
  )
  if (attackerInjuries.length > 0) {
    flags.push({
      type: "MODERADA",
      message: `Atacante lesionado: ${attackerInjuries.map(i => i.player?.name).join(", ")}`,
      source: "injuries"
    })
  }

  return flags
}

/**
 * Calcula ajustes nos 33 critérios baseado em dados enriquecidos
 */
export function calcularAjustesCriterios(
  enhancedData: EnhancedData,
  htStats: any
): CriteriaAdjustment[] {
  const adjustments: CriteriaAdjustment[] = []

  // CRITÉRIO 1: Segmentação por Liga (usar standings para medir força)
  if (enhancedData.standings && enhancedData.standings.length > 0) {
    const avgPoints = enhancedData.standings.reduce((sum, t) => sum + (t.points || 0), 0) / enhancedData.standings.length
    const competitiveness = avgPoints > 40 ? 10 : avgPoints > 30 ? 5 : 0
    adjustments.push({
      criteriaId: 1,
      adjustment: competitiveness,
      reason: `Liga competitiva (média ${avgPoints.toFixed(1)} pontos)`
    })
  }

  // CRITÉRIO 3: Forma Recente (usar últimos jogos de fixtures)
  if (enhancedData.h2h && enhancedData.h2h.length > 0) {
    const recentGames = enhancedData.h2h.slice(0, 5)
    const awayWins = recentGames.filter(g => 
      g.teams?.away?.winner === true
    ).length
    const formAdjustment = awayWins * 3 - 7 // -7 a +8
    adjustments.push({
      criteriaId: 3,
      adjustment: formAdjustment,
      reason: `${awayWins} vitórias nos últimos 5 H2H`
    })
  }

  // CRITÉRIO 4: xG ajustado por escalação
  if (enhancedData.lineups && enhancedData.lineups.length > 0) {
    const awayLineup = enhancedData.lineups[1] || enhancedData.lineups[0]
    const startXI = awayLineup?.startXI || []
    const substitutes = awayLineup?.substitutes || []
    
    // Se tem muitos reservas no XI inicial
    const reserveRatio = substitutes.length / (startXI.length + substitutes.length + 0.01)
    if (reserveRatio > 0.3) {
      adjustments.push({
        criteriaId: 4,
        adjustment: -10,
        reason: "Time com muitos reservas na escalação"
      })
    }
  }

  // CRITÉRIO 5: Motivação real (posição na tabela)
  if (enhancedData.standings && enhancedData.standings.length > 0) {
    const totalTeams = enhancedData.standings.length
    const awayTeamPos = enhancedData.standings.findIndex(s => s.team?.id === htStats?.awayTeamId)
    
    if (awayTeamPos !== -1) {
      let motivationBonus = 0
      
      // Brigando por título (top 4)
      if (awayTeamPos < 4) motivationBonus = 10
      // Brigando por vaga (5-8)
      else if (awayTeamPos < 8) motivationBonus = 5
      // Fugindo do rebaixamento (últimos 4)
      else if (awayTeamPos >= totalTeams - 4) motivationBonus = 8
      // Zona morta
      else motivationBonus = -5
      
      adjustments.push({
        criteriaId: 5,
        adjustment: motivationBonus,
        reason: `Posição ${awayTeamPos + 1}º - ${motivationBonus > 0 ? "alta" : "baixa"} motivação`
      })
    }
  }

  // CRITÉRIO 6: Red Flags de escalação
  if (enhancedData.injuries && enhancedData.injuries.length > 0) {
    const criticalInjuries = enhancedData.injuries.filter(
      i => i.player?.pos === "Goalkeeper" || 
           i.player?.pos === "Defender" ||
           (i.player?.rating && parseFloat(i.player.rating) > 7.5)
    )
    
    if (criticalInjuries.length > 0) {
      adjustments.push({
        criteriaId: 6,
        adjustment: -criticalInjuries.length * 5,
        reason: `${criticalInjuries.length} lesão(ões) crítica(s)`
      })
    }
  }

  // CRITÉRIO 8: Movimentação das Odds
  if (enhancedData.odds && enhancedData.odds.length > 0) {
    const mainOdds = enhancedData.odds[0]?.bookmakers?.[0]?.bets?.find(
      (b: any) => b.name === "Match Winner"
    )
    
    if (mainOdds) {
      const awayOdd = mainOdds.values?.find((v: any) => v.value === "Away")?.odd
      const homeOdd = mainOdds.values?.find((v: any) => v.value === "Home")?.odd
      
      // Detectar "favorito falso" (odd caiu sem justificativa)
      if (awayOdd && homeOdd && parseFloat(awayOdd) < parseFloat(homeOdd)) {
        adjustments.push({
          criteriaId: 8,
          adjustment: 8,
          reason: "Visitante favorito nas odds - possível valor"
        })
      }
    }
  }

  // CRITÉRIO 9: Top Scorer Dependency
  if (enhancedData.topscorers && enhancedData.topscorers.length > 0) {
    const topScorer = enhancedData.topscorers[0]
    const topScorerTeam = topScorer?.statistics?.[0]?.team?.id
    
    // Se o artilheiro é do time visitante
    if (topScorerTeam === htStats?.awayTeamId) {
      const isInjured = enhancedData.injuries.some(
        i => i.player?.id === topScorer?.player?.id
      )
      
      if (isInjured) {
        adjustments.push({
          criteriaId: 9,
          adjustment: -15,
          reason: `Artilheiro ${topScorer?.player?.name} lesionado`
        })
      } else {
        adjustments.push({
          criteriaId: 9,
          adjustment: 5,
          reason: `Artilheiro ${topScorer?.player?.name} disponível`
        })
      }
    }
  }

  // CRITÉRIO 11: Previsão da API (dado auxiliar)
  if (enhancedData.predictions) {
    const prediction = enhancedData.predictions.predictions
    const awayWinProb = parseFloat(prediction?.percent?.away?.replace("%", "") || "0")
    
    if (awayWinProb > 35) {
      adjustments.push({
        criteriaId: 11,
        adjustment: 5,
        reason: `API prevê ${awayWinProb}% chance visitante`
      })
    }
  }

  return adjustments
}

/**
 * Calcula Neural Score com dados enriquecidos
 */
export function neuralScore(
  criterios: any[],
  redFlags: RedFlag[],
  htStats: any,
  standings: any[],
  lineups: any[]
): number {
  // Score base dos critérios
  const avgCriteriaScore = criterios.reduce((sum, c) => sum + c.score, 0) / criterios.length

  // Penalidade por red flags
  const criticalFlags = redFlags.filter(f => f.type === "CRÍTICA").length
  const moderateFlags = redFlags.filter(f => f.type === "MODERADA").length
  const flagPenalty = criticalFlags * 20 + moderateFlags * 10

  // Ajuste por posição na tabela
  let standingsBonus = 0
  if (standings.length > 0) {
    const awayPos = standings.findIndex(s => s.team?.id === htStats?.awayTeamId)
    if (awayPos !== -1) {
      const totalTeams = standings.length
      // Bonus para times no meio-alto da tabela (mais consistentes)
      if (awayPos >= 4 && awayPos <= 10) standingsBonus = 5
    }
  }

  // Ajuste por qualidade da escalação
  let lineupBonus = 0
  if (lineups.length > 0) {
    const awayLineup = lineups[1] || lineups[0]
    const startXI = awayLineup?.startXI || []
    // Bonus se escalação está completa
    if (startXI.length === 11) lineupBonus = 3
  }

  // Ajuste por estilo de jogo (baseado em estatísticas)
  let styleBonus = 0
  if (htStats) {
    const possessionBalance = Math.abs(htStats.possessionHome - htStats.possessionAway)
    // Bonus para jogos equilibrados (melhor para HA+)
    if (possessionBalance < 15) styleBonus = 5
  }

  // Pesos dinâmicos
  const weights = {
    criteria: 0.5,
    flags: 0.2,
    standings: 0.1,
    lineup: 0.1,
    style: 0.1
  }

  const neuralScore = 
    avgCriteriaScore * weights.criteria -
    flagPenalty * weights.flags +
    standingsBonus * weights.standings +
    lineupBonus * weights.lineup +
    styleBonus * weights.style

  return Math.max(0, Math.min(100, Math.round(neuralScore)))
}

/**
 * Ajusta linha HA+ baseado em dados enriquecidos
 */
export function ajustarLinhaHA(
  haLine: string,
  enhancedData: EnhancedData,
  htStats: any
): { adjustedLine: string; reason: string } {
  const lineValue = parseFloat(haLine.replace("+", ""))
  let adjustment = 0
  const reasons: string[] = []

  // Ajustar por histórico H2H
  if (enhancedData.h2h && enhancedData.h2h.length > 0) {
    const closeGames = enhancedData.h2h.filter(g => {
      const homeGoals = g.goals?.home || 0
      const awayGoals = g.goals?.away || 0
      return Math.abs(homeGoals - awayGoals) <= 1
    }).length
    
    const closeGameRatio = closeGames / enhancedData.h2h.length
    if (closeGameRatio > 0.6) {
      adjustment -= 0.25 // Jogos costumam ser apertados, pode ser mais agressivo
      reasons.push("Histórico de jogos apertados")
    }
  }

  // Ajustar por motivação
  if (enhancedData.standings && enhancedData.standings.length > 0) {
    const awayPos = enhancedData.standings.findIndex(s => s.team?.id === htStats?.awayTeamId)
    if (awayPos !== -1 && awayPos < 4) {
      adjustment -= 0.25 // Time brigando por título, mais confiável
      reasons.push("Time brigando por título")
    }
  }

  // Ajustar por lesões
  if (enhancedData.injuries && enhancedData.injuries.length > 2) {
    adjustment += 0.25 // Muitas lesões, ser mais conservador
    reasons.push("Múltiplas lesões no elenco")
  }

  const newLineValue = Math.max(0.25, Math.min(2.0, lineValue + adjustment))
  const adjustedLine = `+${newLineValue.toFixed(2)}`

  return {
    adjustedLine: adjustment !== 0 ? adjustedLine : haLine,
    reason: reasons.length > 0 ? reasons.join("; ") : "Linha mantida"
  }
}

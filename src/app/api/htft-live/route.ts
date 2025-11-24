import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamName, fixtureId, minute, haLine, haOdd } = body

    // Validações
    if (!haLine || !haOdd) {
      return NextResponse.json(
        { error: "Parâmetros haLine e haOdd são obrigatórios" },
        { status: 400 }
      )
    }

    if (!fixtureId && !teamName) {
      return NextResponse.json(
        { error: "Informe o nome do time ou o Fixture ID" },
        { status: 400 }
      )
    }

    const apiKey = process.env.API_FOOTBALL_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: "API_FOOTBALL_KEY não configurada no servidor" },
        { status: 500 }
      )
    }

    let finalFixtureId = fixtureId

    // Se não tiver fixtureId, buscar pelo nome do time
    if (!finalFixtureId && teamName) {
      const liveResponse = await fetch(
        `https://v3.football.api-sports.io/fixtures?live=all`,
        {
          method: "GET",
          headers: {
            "x-apisports-key": apiKey
          }
        }
      )

      if (!liveResponse.ok) {
        throw new Error(`Erro ao buscar jogos ao vivo: ${liveResponse.status}`)
      }

      const liveData = await liveResponse.json()
      const fixtures = liveData.response || []

      // Buscar fixture pelo nome do time
      const fixture = fixtures.find((f: any) => {
        const homeName = f.teams?.home?.name?.toLowerCase() || ""
        const awayName = f.teams?.away?.name?.toLowerCase() || ""
        const searchName = teamName.toLowerCase()
        return homeName.includes(searchName) || awayName.includes(searchName)
      })

      if (!fixture) {
        return NextResponse.json(
          { error: `Nenhum jogo ao vivo encontrado para o time "${teamName}"` },
          { status: 404 }
        )
      }

      finalFixtureId = fixture.fixture?.id
    }

    if (!finalFixtureId) {
      return NextResponse.json(
        { error: "Não foi possível identificar o jogo" },
        { status: 400 }
      )
    }

    // Buscar dados do fixture
    const fixtureResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures?id=${finalFixtureId}`,
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey
        }
      }
    )

    if (!fixtureResponse.ok) {
      throw new Error(`Erro ao buscar fixture: ${fixtureResponse.status}`)
    }

    const fixtureData = await fixtureResponse.json()
    const fixture = fixtureData.response?.[0]

    if (!fixture) {
      return NextResponse.json(
        { error: "Fixture não encontrado" },
        { status: 404 }
      )
    }

    // Buscar estatísticas
    const statsResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${finalFixtureId}`,
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey
        }
      }
    )

    let statistics = []
    if (statsResponse.ok) {
      const statsData = await statsResponse.json()
      statistics = statsData.response || []
    }

    // Buscar eventos (cartões, gols, etc.)
    const eventsResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures/events?fixture=${finalFixtureId}`,
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey
        }
      }
    )

    let events = []
    if (eventsResponse.ok) {
      const eventsData = await eventsResponse.json()
      events = eventsData.response || []
    }

    // Função auxiliar para extrair estatística
    const getStat = (teamStats: any[], statType: string): number => {
      const stat = teamStats.find((s: any) => s.type === statType)
      if (!stat || !stat.value) return 0
      
      const value = String(stat.value).replace("%", "")
      return parseInt(value) || 0
    }

    // Extrair estatísticas por time
    const homeStats = statistics[0]?.statistics || []
    const awayStats = statistics[1]?.statistics || []

    // Contar cartões dos eventos
    const yellowHome = events.filter(
      (e: any) => e.type === "Card" && e.detail === "Yellow Card" && e.team?.id === fixture.teams?.home?.id
    ).length

    const yellowAway = events.filter(
      (e: any) => e.type === "Card" && e.detail === "Yellow Card" && e.team?.id === fixture.teams?.away?.id
    ).length

    const redHome = events.filter(
      (e: any) => e.type === "Card" && e.detail === "Red Card" && e.team?.id === fixture.teams?.home?.id
    ).length

    const redAway = events.filter(
      (e: any) => e.type === "Card" && e.detail === "Red Card" && e.team?.id === fixture.teams?.away?.id
    ).length

    // Placar atual
    const scoreHome = fixture.goals?.home ?? 0
    const scoreAway = fixture.goals?.away ?? 0

    // Minuto atual
    const currentMinute = fixture.fixture?.status?.elapsed || minute || 45

    // Identificar qual lado é o time analisado
    const homeTeamName = fixture.teams?.home?.name?.toLowerCase() || ""
    const awayTeamName = fixture.teams?.away?.name?.toLowerCase() || ""
    const searchName = (teamName || "").toLowerCase()
    
    let analyzedTeamSide: "home" | "away" = "away"
    if (homeTeamName.includes(searchName)) {
      analyzedTeamSide = "home"
    } else if (awayTeamName.includes(searchName)) {
      analyzedTeamSide = "away"
    }

    // Consolidar liveData
    const liveData = {
      fixtureId: finalFixtureId,
      homeTeam: fixture.teams?.home?.name || "Time Casa",
      awayTeam: fixture.teams?.away?.name || "Time Visitante",
      scoreHome,
      scoreAway,
      shotsHome: getStat(homeStats, "Total Shots"),
      shotsAway: getStat(awayStats, "Total Shots"),
      shotsOnGoalHome: getStat(homeStats, "Shots on Goal"),
      shotsOnGoalAway: getStat(awayStats, "Shots on Goal"),
      dangerousAttacksHome: getStat(homeStats, "Dangerous Attacks"),
      dangerousAttacksAway: getStat(awayStats, "Dangerous Attacks"),
      possessionHome: getStat(homeStats, "Ball Possession"),
      possessionAway: getStat(awayStats, "Ball Possession"),
      cornersHome: getStat(homeStats, "Corner Kicks"),
      cornersAway: getStat(awayStats, "Corner Kicks"),
      yellowHome,
      yellowAway,
      redHome,
      redAway,
      currentMinute,
      analyzedTeamSide
    }

    // Calcular scores internos
    const analyzedStats = analyzedTeamSide === "home" ? homeStats : awayStats
    const opponentStats = analyzedTeamSide === "home" ? awayStats : homeStats

    const analyzedShots = getStat(analyzedStats, "Total Shots")
    const analyzedShotsOnGoal = getStat(analyzedStats, "Shots on Goal")
    const analyzedDangerousAttacks = getStat(analyzedStats, "Dangerous Attacks")
    const analyzedPossession = getStat(analyzedStats, "Ball Possession")

    const opponentShots = getStat(opponentStats, "Total Shots")
    const opponentShotsOnGoal = getStat(opponentStats, "Shots on Goal")
    const opponentDangerousAttacks = getStat(opponentStats, "Dangerous Attacks")

    // Pressure Score (0-100)
    const totalShots = analyzedShots + opponentShots
    const totalShotsOnGoal = analyzedShotsOnGoal + opponentShotsOnGoal
    const totalDangerousAttacks = analyzedDangerousAttacks + opponentDangerousAttacks

    const shotsProportion = totalShots > 0 ? analyzedShots / totalShots : 0.5
    const shotsOnGoalProportion = totalShotsOnGoal > 0 ? analyzedShotsOnGoal / totalShotsOnGoal : 0.5
    const dangerousAttacksProportion = totalDangerousAttacks > 0 ? analyzedDangerousAttacks / totalDangerousAttacks : 0.5
    const possessionProportion = analyzedPossession / 100

    const pressureScore = Math.round(
      shotsProportion * 25 +
      shotsOnGoalProportion * 30 +
      dangerousAttacksProportion * 30 +
      possessionProportion * 15
    )

    // Discipline Risk (0-100, quanto maior, pior)
    const analyzedYellow = analyzedTeamSide === "home" ? yellowHome : yellowAway
    const analyzedRed = analyzedTeamSide === "home" ? redHome : redAway

    const disciplineRisk = Math.min(100, analyzedYellow * 15 + analyzedRed * 50)

    // Comeback Potential (baseado em placar e pressão)
    const scoreDiff = analyzedTeamSide === "home" ? scoreHome - scoreAway : scoreAway - scoreHome
    let comebackPotential = 50

    if (scoreDiff >= 0) {
      // Ganhando ou empatando
      comebackPotential = 70 + pressureScore * 0.3
    } else if (scoreDiff === -1) {
      // Perdendo por 1
      comebackPotential = 50 + pressureScore * 0.4
    } else if (scoreDiff <= -2) {
      // Perdendo por 2+
      comebackPotential = 30 + pressureScore * 0.2
    }

    comebackPotential = Math.round(Math.max(0, Math.min(100, comebackPotential)))

    // Live Overall Score (combinação de tudo)
    const liveOverallScore = Math.round(
      pressureScore * 0.4 +
      (100 - disciplineRisk) * 0.3 +
      comebackPotential * 0.3
    )

    const internalScores = {
      pressureScore,
      disciplineRisk,
      comebackPotential,
      liveOverallScore
    }

    return NextResponse.json({
      liveData,
      internalScores,
      haLine,
      haOdd
    })

  } catch (error: any) {
    console.error("Erro em /api/htft-live:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar dados LIVE" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const fixtureId = searchParams.get("fixtureId")
  const includeEnhanced = searchParams.get("enhanced") === "true"

  if (!fixtureId) {
    return NextResponse.json(
      { error: "Parâmetro fixtureId é obrigatório" },
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

  try {
    // Chamada REAL à API-Football
    const response = await fetch(
      `https://v3.football.api-sports.io/fixtures?id=${fixtureId}`,
      {
        method: "GET",
        headers: {
          "x-apisports-key": apiKey
        }
      }
    )

    if (!response.ok) {
      throw new Error(`API-Football retornou status ${response.status}`)
    }

    const data = await response.json()

    if (!data.response || data.response.length === 0) {
      return NextResponse.json(
        { error: "Fixture não encontrado na API-Football" },
        { status: 404 }
      )
    }

    const fixture = data.response[0]

    // Buscar estatísticas do jogo
    const statsResponse = await fetch(
      `https://v3.football.api-sports.io/fixtures/statistics?fixture=${fixtureId}`,
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

    // Extrair dados do placar HT
    const halftimeScore = fixture.score?.halftime
      ? `${fixture.score.halftime.home ?? 0}-${fixture.score.halftime.away ?? 0}`
      : "0-0"

    // Função auxiliar para extrair estatística
    const getStat = (teamStats: any[], statType: string): number => {
      const stat = teamStats.find((s: any) => s.type === statType)
      if (!stat || !stat.value) return 0
      
      // Remover % se houver
      const value = String(stat.value).replace("%", "")
      return parseInt(value) || 0
    }

    // Extrair estatísticas por time
    const homeStats = statistics[0]?.statistics || []
    const awayStats = statistics[1]?.statistics || []

    // Mapear para o formato esperado
    const htSummary: any = {
      fixtureId: parseInt(fixtureId),
      homeTeam: fixture.teams?.home?.name || "Time Casa",
      awayTeam: fixture.teams?.away?.name || "Time Visitante",
      homeTeamId: fixture.teams?.home?.id,
      awayTeamId: fixture.teams?.away?.id,
      leagueId: fixture.league?.id,
      season: fixture.league?.season,
      halftimeScore,
      shotsTotalHome: getStat(homeStats, "Total Shots"),
      shotsOnTargetHome: getStat(homeStats, "Shots on Goal"),
      shotsTotalAway: getStat(awayStats, "Total Shots"),
      shotsOnTargetAway: getStat(awayStats, "Shots on Goal"),
      dangerousAttacksHome: getStat(homeStats, "Dangerous Attacks"),
      dangerousAttacksAway: getStat(awayStats, "Dangerous Attacks"),
      possessionHome: getStat(homeStats, "Ball Possession"),
      possessionAway: getStat(awayStats, "Ball Possession"),
      cornersHome: getStat(homeStats, "Corner Kicks"),
      cornersAway: getStat(awayStats, "Corner Kicks"),
      yellowHome: getStat(homeStats, "Yellow Cards"),
      yellowAway: getStat(awayStats, "Yellow Cards"),
      redHome: getStat(homeStats, "Red Cards"),
      redAway: getStat(awayStats, "Red Cards")
    }

    // Se solicitado, buscar dados enriquecidos
    if (includeEnhanced) {
      try {
        const enhancedResponse = await fetch(
          `${request.nextUrl.origin}/api/enhanced-data`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              fixtureId,
              leagueId: fixture.league?.id,
              season: fixture.league?.season,
              homeTeamId: fixture.teams?.home?.id,
              awayTeamId: fixture.teams?.away?.id
            })
          }
        )

        if (enhancedResponse.ok) {
          const enhancedData = await enhancedResponse.json()
          htSummary.enhanced = enhancedData
        }
      } catch (err) {
        console.error("Erro ao buscar dados enriquecidos:", err)
        // Não falhar a requisição se dados enriquecidos falharem
      }
    }

    return NextResponse.json(htSummary)
  } catch (error: any) {
    console.error("Erro ao buscar dados do HT:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar dados do 1º tempo" },
      { status: 500 }
    )
  }
}

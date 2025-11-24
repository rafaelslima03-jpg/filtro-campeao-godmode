import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const teamName = searchParams.get("teamName")

  if (!teamName) {
    return NextResponse.json(
      { error: "Parâmetro teamName é obrigatório" },
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
    // Chamada REAL à API-Football para buscar jogos ao vivo
    const response = await fetch(
      "https://v3.football.api-sports.io/fixtures?live=all",
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
        { error: "Nenhum jogo ao vivo encontrado no momento" },
        { status: 404 }
      )
    }

    // Buscar fixture que contenha o nome do time (case-insensitive)
    const teamNameLower = teamName.toLowerCase()
    const fixture = data.response.find((f: any) => {
      const homeName = f.teams?.home?.name?.toLowerCase() || ""
      const awayName = f.teams?.away?.name?.toLowerCase() || ""
      return homeName.includes(teamNameLower) || awayName.includes(teamNameLower)
    })

    if (!fixture) {
      return NextResponse.json(
        { error: `Nenhum jogo ao vivo encontrado para o time "${teamName}"` },
        { status: 404 }
      )
    }

    // Retornar dados do fixture encontrado
    return NextResponse.json({
      fixtureId: fixture.fixture?.id,
      homeTeam: fixture.teams?.home?.name || "Time Casa",
      awayTeam: fixture.teams?.away?.name || "Time Visitante",
      status: fixture.fixture?.status?.short || "LIVE",
      elapsed: fixture.fixture?.status?.elapsed || 0,
      league: fixture.league?.name || "Liga Desconhecida"
    })
  } catch (error: any) {
    console.error("Erro ao buscar fixture ao vivo:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar jogo ao vivo" },
      { status: 500 }
    )
  }
}

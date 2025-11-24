import { NextRequest, NextResponse } from "next/server"

/**
 * Rota para buscar dados enriquecidos da API-Football
 * Endpoints: standings, h2h, events, lineups, injuries, topscorers, odds, predictions
 */

const API_BASE = "https://v3.football.api-sports.io"

interface EnhancedDataRequest {
  fixtureId?: string
  leagueId?: string
  season?: string
  teamId?: string
  homeTeamId?: string
  awayTeamId?: string
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.API_FOOTBALL_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: "API_FOOTBALL_KEY não configurada" },
      { status: 500 }
    )
  }

  try {
    const body: EnhancedDataRequest = await request.json()
    const { fixtureId, leagueId, season, teamId, homeTeamId, awayTeamId } = body

    const headers = {
      "x-apisports-key": apiKey
    }

    // Objeto para armazenar todos os dados
    const enhancedData: any = {
      standings: null,
      h2h: null,
      events: null,
      lineups: null,
      injuries: null,
      topscorers: null,
      odds: null,
      predictions: null
    }

    // 1. STANDINGS - Classificação
    if (leagueId && season) {
      try {
        const standingsRes = await fetch(
          `${API_BASE}/standings?league=${leagueId}&season=${season}`,
          { headers }
        )
        if (standingsRes.ok) {
          const standingsData = await standingsRes.json()
          enhancedData.standings = standingsData.response?.[0]?.league?.standings?.[0] || []
        }
      } catch (err) {
        console.error("Erro ao buscar standings:", err)
      }
    }

    // 2. HEAD-TO-HEAD - Confronto direto
    if (homeTeamId && awayTeamId) {
      try {
        const h2hRes = await fetch(
          `${API_BASE}/fixtures/headtohead?h2h=${homeTeamId}-${awayTeamId}&last=10`,
          { headers }
        )
        if (h2hRes.ok) {
          const h2hData = await h2hRes.json()
          enhancedData.h2h = h2hData.response || []
        }
      } catch (err) {
        console.error("Erro ao buscar H2H:", err)
      }
    }

    // 3. EVENTS - Eventos do jogo (cartões, gols, substituições)
    if (fixtureId) {
      try {
        const eventsRes = await fetch(
          `${API_BASE}/fixtures/events?fixture=${fixtureId}`,
          { headers }
        )
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json()
          enhancedData.events = eventsData.response || []
        }
      } catch (err) {
        console.error("Erro ao buscar events:", err)
      }
    }

    // 4. LINEUPS - Escalações
    if (fixtureId) {
      try {
        const lineupsRes = await fetch(
          `${API_BASE}/fixtures/lineups?fixture=${fixtureId}`,
          { headers }
        )
        if (lineupsRes.ok) {
          const lineupsData = await lineupsRes.json()
          enhancedData.lineups = lineupsData.response || []
        }
      } catch (err) {
        console.error("Erro ao buscar lineups:", err)
      }
    }

    // 5. INJURIES - Lesões
    if (fixtureId) {
      try {
        const injuriesRes = await fetch(
          `${API_BASE}/injuries?fixture=${fixtureId}`,
          { headers }
        )
        if (injuriesRes.ok) {
          const injuriesData = await injuriesRes.json()
          enhancedData.injuries = injuriesData.response || []
        }
      } catch (err) {
        console.error("Erro ao buscar injuries:", err)
      }
    }

    // 6. TOP SCORERS - Artilheiros
    if (leagueId && season) {
      try {
        const topscorersRes = await fetch(
          `${API_BASE}/players/topscorers?league=${leagueId}&season=${season}`,
          { headers }
        )
        if (topscorersRes.ok) {
          const topscorersData = await topscorersRes.json()
          enhancedData.topscorers = topscorersData.response?.slice(0, 20) || []
        }
      } catch (err) {
        console.error("Erro ao buscar topscorers:", err)
      }
    }

    // 7. ODDS - Odds pré-jogo
    if (fixtureId) {
      try {
        const oddsRes = await fetch(
          `${API_BASE}/odds?fixture=${fixtureId}`,
          { headers }
        )
        if (oddsRes.ok) {
          const oddsData = await oddsRes.json()
          enhancedData.odds = oddsData.response || []
        }
      } catch (err) {
        console.error("Erro ao buscar odds:", err)
      }
    }

    // 8. PREDICTIONS - Previsões da API
    if (fixtureId) {
      try {
        const predictionsRes = await fetch(
          `${API_BASE}/predictions?fixture=${fixtureId}`,
          { headers }
        )
        if (predictionsRes.ok) {
          const predictionsData = await predictionsRes.json()
          enhancedData.predictions = predictionsData.response?.[0] || null
        }
      } catch (err) {
        console.error("Erro ao buscar predictions:", err)
      }
    }

    return NextResponse.json(enhancedData)
  } catch (error: any) {
    console.error("Erro ao buscar dados enriquecidos:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao buscar dados enriquecidos" },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from "next/server"
import { 
  RADAR_LEAGUES, 
  calculateRDS, 
  applyMiniFiltro, 
  calculateScoreRadar,
  calculatePreLiveScore,
  type RadarGame 
} from "@/lib/radarLogic"
import { sendTelegramAlert } from "@/lib/telegram"

const API_FOOTBALL_KEY = process.env.API_FOOTBALL_KEY || ""
const API_FOOTBALL_HOST = "v3.football.api-sports.io"

interface RadarRequest {
  mode: "preLive" | "live"
  leagues?: number[]
  minScoreRadar?: number
  maxGames?: number
}

// ==================== LOG DE PERFORMANCE ====================
interface PerformanceLog {
  timestamp: string
  mode: string
  leagueId: number
  leagueName: string
  fixtureId: number
  minute: number
  scoreRadarFinal: number
  confidenceLevel: string
  goldSignal: boolean
  finalScore?: string
}

const performanceLogs: PerformanceLog[] = []

function logPerformance(log: PerformanceLog) {
  performanceLogs.push(log)
  // Manter apenas últimos 1000 logs
  if (performanceLogs.length > 1000) {
    performanceLogs.shift()
  }
}

// ==================== NÍVEIS DE CONFIANÇA ====================
function getConfidenceLevel(score: number): string {
  if (score >= 90) return "Elite"
  if (score >= 80) return "Alto"
  if (score >= 70) return "Bom"
  if (score >= 60) return "Acompanhar"
  return "Sem Interesse"
}

// ==================== RETRY COM TOLERÂNCIA A FALHAS ====================
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options)
      if (response.ok) {
        return response
      }
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error as Error
      if (attempt < maxRetries) {
        // Aguardar 3 segundos antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    }
  }
  
  throw lastError || new Error("Falha após múltiplas tentativas")
}

// ==================== RASTREAMENTO DE JOGOS ====================
// Armazena estado dos jogos para detectar mudanças
interface GameState {
  fixtureId: number
  minute: number
  lastAlertMinute: number
  hadGoodProfile: boolean
  alreadyNotifiedStart: boolean
}

const gameStates = new Map<number, GameState>()

export async function POST(request: NextRequest) {
  try {
    const body: RadarRequest = await request.json()
    const { mode, leagues, minScoreRadar = 70, maxGames = 20 } = body

    // Validar API Key
    if (!API_FOOTBALL_KEY) {
      return NextResponse.json(
        { error: "API_FOOTBALL_KEY não configurada" },
        { status: 500 }
      )
    }

    // Determinar ligas a escanear
    const leaguesToScan = leagues && leagues.length > 0
      ? RADAR_LEAGUES.filter(l => leagues.includes(l.id))
      : RADAR_LEAGUES

    if (leaguesToScan.length === 0) {
      return NextResponse.json(
        { error: "Nenhuma liga válida selecionada" },
        { status: 400 }
      )
    }

    let allGames: RadarGame[] = []

    if (mode === "live") {
      // ==================== MODO LIVE ====================
      for (const league of leaguesToScan) {
        try {
          // 1. Buscar jogos ao vivo da liga (com retry)
          const fixturesResponse = await fetchWithRetry(
            `https://${API_FOOTBALL_HOST}/fixtures?live=all&league=${league.id}`,
            {
              headers: {
                "x-rapidapi-key": API_FOOTBALL_KEY,
                "x-rapidapi-host": API_FOOTBALL_HOST
              }
            }
          )

          const fixturesData = await fixturesResponse.json()
          const fixtures = fixturesData.response || []

          if (fixtures.length === 0) continue

          // 2. Para cada jogo, buscar estatísticas e eventos
          for (const fixture of fixtures) {
            const fixtureId = fixture.fixture.id
            const minute = fixture.fixture.status.elapsed || 0

            // ==================== ALERTA: JOGO INICIADO ====================
            let gameState = gameStates.get(fixtureId)
            if (!gameState) {
              gameState = {
                fixtureId,
                minute,
                lastAlertMinute: 0,
                hadGoodProfile: false,
                alreadyNotifiedStart: false
              }
              gameStates.set(fixtureId, gameState)
            }

            // Enviar alerta quando jogo inicia (minuto 1-5)
            if (minute >= 1 && minute <= 5 && !gameState.alreadyNotifiedStart) {
              const startMessage = `🟢 *JOGO INICIADO – MONITORANDO PARA HA+*\n\n` +
                `⚽ ${fixture.teams.home.name} vs ${fixture.teams.away.name}\n` +
                `🏆 Liga: ${league.name}\n` +
                `⏱️ Minuto: ${minute}'\n` +
                `📊 Placar: ${fixture.goals.home || 0} x ${fixture.goals.away || 0}\n\n` +
                `🔍 Sistema monitorando estatísticas para detectar oportunidades de HA+`

              await sendTelegramAlert(startMessage)
              gameState.alreadyNotifiedStart = true
            }

            // Buscar estatísticas (com retry)
            const statsResponse = await fetchWithRetry(
              `https://${API_FOOTBALL_HOST}/fixtures/statistics?fixture=${fixtureId}`,
              {
                headers: {
                  "x-rapidapi-key": API_FOOTBALL_KEY,
                  "x-rapidapi-host": API_FOOTBALL_HOST
                }
              }
            )

            const statsData = await statsResponse.json()
            const statistics = statsData.response || []

            if (statistics.length < 2) continue

            // Extrair estatísticas
            const homeStats = statistics[0]?.statistics || []
            const awayStats = statistics[1]?.statistics || []

            const getStat = (stats: any[], type: string): number => {
              const stat = stats.find((s: any) => s.type === type)
              if (!stat || stat.value === null) return 0
              if (typeof stat.value === "string") {
                return parseInt(stat.value.replace("%", ""), 10) || 0
              }
              return stat.value || 0
            }

            const homeStatsObj = {
              shotsOnTarget: getStat(homeStats, "Shots on Goal"),
              totalShots: getStat(homeStats, "Total Shots"),
              possession: getStat(homeStats, "Ball Possession"),
              corners: getStat(homeStats, "Corner Kicks"),
              dangerousAttacks: getStat(homeStats, "Dangerous Attacks")
            }

            const awayStatsObj = {
              shotsOnTarget: getStat(awayStats, "Shots on Goal"),
              totalShots: getStat(awayStats, "Total Shots"),
              possession: getStat(awayStats, "Ball Possession"),
              corners: getStat(awayStats, "Corner Kicks"),
              dangerousAttacks: getStat(awayStats, "Dangerous Attacks")
            }

            // Buscar eventos (cartões) (com retry)
            const eventsResponse = await fetchWithRetry(
              `https://${API_FOOTBALL_HOST}/fixtures/events?fixture=${fixtureId}`,
              {
                headers: {
                  "x-rapidapi-key": API_FOOTBALL_KEY,
                  "x-rapidapi-host": API_FOOTBALL_HOST
                }
              }
            )

            let redHome = 0
            let redAway = 0

            if (eventsResponse.ok) {
              const eventsData = await eventsResponse.json()
              const events = eventsData.response || []

              events.forEach((event: any) => {
                if (event.type === "Card" && event.detail === "Red Card") {
                  if (event.team.id === fixture.teams.home.id) redHome++
                  else redAway++
                }
              })
            }

            // Calcular RDS
            const rdsHome = calculateRDS(homeStatsObj)
            const rdsAway = calculateRDS(awayStatsObj)
            const rdsDiff = rdsAway - rdsHome

            // Aplicar mini-filtro
            const filtroResult = applyMiniFiltro(
              homeStatsObj,
              awayStatsObj,
              rdsHome,
              rdsAway,
              redHome,
              redAway
            )

            // ==================== ALERTA: SINAL CANCELADO ====================
            // Se jogo tinha bom perfil mas perdeu
            if (gameState.hadGoodProfile && !filtroResult.passed) {
              const cancelMessage = `❌ *SINAL CANCELADO – JOGO PERDEU PERFIL DE HA+*\n\n` +
                `⚽ ${fixture.teams.home.name} vs ${fixture.teams.away.name}\n` +
                `🏆 Liga: ${league.name}\n` +
                `⏱️ Minuto: ${minute}'\n` +
                `📊 Placar: ${fixture.goals.home || 0} x ${fixture.goals.away || 0}\n\n` +
                `⚠️ Motivo: ${filtroResult.reasons.join(", ")}`

              await sendTelegramAlert(cancelMessage)
              gameState.hadGoodProfile = false
            }

            if (!filtroResult.passed) continue

            // Calcular Score Radar
            const scoreResult = calculateScoreRadar(
              homeStatsObj,
              awayStatsObj,
              rdsHome,
              rdsAway,
              fixture.goals.home || 0,
              fixture.goals.away || 0,
              minute,
              league.weight,
              fixture.odds?.values?.[0] ? {
                home: fixture.odds.values[0].odd,
                draw: fixture.odds.values[1]?.odd || 0,
                away: fixture.odds.values[2]?.odd || 0
              } : undefined
            )

            const confidenceLevel = getConfidenceLevel(scoreResult.scoreRadarFinal)

            // ==================== ALERTA: REANÁLISE AOS 60 MINUTOS ====================
            if (minute >= 60 && minute <= 62 && gameState.lastAlertMinute < 60) {
              // Análise completa aos 60 minutos
              const shouldEnter = scoreResult.scoreRadarFinal >= 75 || scoreResult.goldSignal
              const recommendation = shouldEnter ? "✅ SIM" : "⚠️ NÃO"
              
              let justification = ""
              if (shouldEnter) {
                justification = `Score Radar: ${scoreResult.scoreRadarFinal} (${confidenceLevel})\n` +
                  `RDS: ${rdsHome} x ${rdsAway} (diferença: ${rdsDiff})\n` +
                  `Finalizações no alvo: ${homeStatsObj.shotsOnTarget} x ${awayStatsObj.shotsOnTarget}\n` +
                  `${scoreResult.goldSignal ? "🏆 GOLD SIGNAL ATIVO\n" : ""}` +
                  `Critérios: ${scoreResult.criterios.slice(0, 3).join(", ")}`
              } else {
                justification = `Score Radar abaixo do mínimo: ${scoreResult.scoreRadarFinal}\n` +
                  `Estatísticas não atingiram critérios suficientes para entrada segura.`
              }

              const analysis60Message = `⏱️ *60' – ANÁLISE FILTRO CAMPEÃO vGODMODE*\n\n` +
                `⚽ ${fixture.teams.home.name} ${fixture.goals.home || 0} x ${fixture.goals.away || 0} ${fixture.teams.away.name}\n` +
                `🏆 Liga: ${league.name}\n\n` +
                `❓ *Recomenda entrar?* ${recommendation}\n\n` +
                `📊 *Justificativa:*\n${justification}`

              await sendTelegramAlert(analysis60Message)
              gameState.lastAlertMinute = minute
            }

            // Filtrar por score mínimo ou Gold Signal
            if (scoreResult.scoreRadarFinal >= minScoreRadar || scoreResult.goldSignal) {
              gameState.hadGoodProfile = true

              const game: RadarGame = {
                fixtureId,
                leagueId: league.id,
                leagueName: league.name,
                importanceWeight: league.weight,
                homeTeam: fixture.teams.home.name,
                awayTeam: fixture.teams.away.name,
                scoreHome: fixture.goals.home || 0,
                scoreAway: fixture.goals.away || 0,
                minute,
                scoreRadarFinal: scoreResult.scoreRadarFinal,
                goldSignal: scoreResult.goldSignal,
                criteriosQueBateram: [...filtroResult.reasons, ...scoreResult.criterios],
                stats: {
                  home: homeStatsObj,
                  away: awayStatsObj,
                  rdsHome,
                  rdsAway,
                  rdsDiff
                },
                odds: fixture.odds?.values?.[0] ? {
                  home: fixture.odds.values[0].odd,
                  draw: fixture.odds.values[1]?.odd || 0,
                  away: fixture.odds.values[2]?.odd || 0
                } : undefined
              }

              allGames.push(game)

              // Log de performance
              logPerformance({
                timestamp: new Date().toISOString(),
                mode: "live",
                leagueId: league.id,
                leagueName: league.name,
                fixtureId,
                minute,
                scoreRadarFinal: scoreResult.scoreRadarFinal,
                confidenceLevel,
                goldSignal: scoreResult.goldSignal
              })
            }
          }
        } catch (error) {
          console.error(`Erro ao processar liga ${league.id}:`, error)
          continue
        }
      }
    } else {
      // ==================== MODO PRÉ-LIVE ====================
      const today = new Date().toISOString().split("T")[0]

      for (const league of leaguesToScan) {
        try {
          // Buscar jogos de hoje da liga (com retry)
          const fixturesResponse = await fetchWithRetry(
            `https://${API_FOOTBALL_HOST}/fixtures?date=${today}&league=${league.id}`,
            {
              headers: {
                "x-rapidapi-key": API_FOOTBALL_KEY,
                "x-rapidapi-host": API_FOOTBALL_HOST
              }
            }
          )

          const fixturesData = await fixturesResponse.json()
          const fixtures = fixturesData.response || []

          if (fixtures.length === 0) continue

          for (const fixture of fixtures) {
            // Verificar se tem odds disponíveis
            if (!fixture.odds?.values?.[0]) continue

            const odds = {
              home: fixture.odds.values[0].odd,
              draw: fixture.odds.values[1]?.odd || 0,
              away: fixture.odds.values[2]?.odd || 0
            }

            // Calcular Score Pré-Live
            const scoreResult = calculatePreLiveScore(
              fixture.teams.home.name,
              fixture.teams.away.name,
              odds,
              league.weight
            )

            const confidenceLevel = getConfidenceLevel(scoreResult.scoreRadarPreLive)

            // Filtrar por score mínimo ou Gold Signal
            if (scoreResult.scoreRadarPreLive >= minScoreRadar || scoreResult.goldSignal) {
              const game: RadarGame = {
                fixtureId: fixture.fixture.id,
                leagueId: league.id,
                leagueName: league.name,
                importanceWeight: league.weight,
                homeTeam: fixture.teams.home.name,
                awayTeam: fixture.teams.away.name,
                scoreHome: 0,
                scoreAway: 0,
                minute: 0,
                scoreRadarFinal: scoreResult.scoreRadarPreLive,
                goldSignal: scoreResult.goldSignal,
                criteriosQueBateram: scoreResult.criterios,
                stats: {
                  home: { shotsOnTarget: 0, totalShots: 0, possession: 0, corners: 0 },
                  away: { shotsOnTarget: 0, totalShots: 0, possession: 0, corners: 0 },
                  rdsHome: 0,
                  rdsAway: 0,
                  rdsDiff: 0
                },
                odds
              }

              allGames.push(game)

              // Log de performance
              logPerformance({
                timestamp: new Date().toISOString(),
                mode: "preLive",
                leagueId: league.id,
                leagueName: league.name,
                fixtureId: fixture.fixture.id,
                minute: 0,
                scoreRadarFinal: scoreResult.scoreRadarPreLive,
                confidenceLevel,
                goldSignal: scoreResult.goldSignal
              })
            }
          }
        } catch (error) {
          console.error(`Erro ao processar liga ${league.id}:`, error)
          continue
        }
      }
    }

    // Ordenar por scoreRadarFinal DESC
    allGames.sort((a, b) => b.scoreRadarFinal - a.scoreRadarFinal)

    // Limitar quantidade
    const games = allGames.slice(0, maxGames)

    // ==================== INTEGRAÇÃO TELEGRAM (ALERTAS CONSOLIDADOS) ====================
    // Filtrar jogos com Gold Signal ou Score >= 75
    const alertGames = games.filter(g => g.goldSignal || g.scoreRadarFinal >= 75)

    if (alertGames.length > 0 && mode === "live") {
      // Montar mensagem consolidada
      let message = "🚨 *RADAR FILTRO CAMPEÃO – ALERTA AO VIVO* 🚨\n\n"
      
      alertGames.forEach((game, index) => {
        const confidence = getConfidenceLevel(game.scoreRadarFinal)
        
        message += `*${index + 1}. ${game.leagueName}*\n`
        message += `⚽ ${game.homeTeam} ${game.scoreHome} x ${game.scoreAway} ${game.awayTeam}\n`
        message += `⏱️ Minuto: ${game.minute}'\n`
        message += `📊 Score Radar: *${game.scoreRadarFinal}* (${confidence})\n`
        
        if (game.goldSignal) {
          message += `🏆 *GOLD SIGNAL ATIVO*\n`
        }
        
        // Mostrar 2-3 critérios principais
        const topCriterios = game.criteriosQueBateram.slice(0, 3)
        if (topCriterios.length > 0) {
          message += `✅ Critérios: ${topCriterios.join(", ")}\n`
        }
        
        message += "\n"
      })

      message += `📈 Total de alertas: ${alertGames.length}\n`
      message += `🕐 ${new Date().toLocaleString("pt-BR")}`

      // Enviar ao Telegram
      await sendTelegramAlert(message)
    }

    return NextResponse.json({
      success: true,
      mode,
      totalGames: games.length,
      games: games.map(g => ({
        ...g,
        confidenceLevel: getConfidenceLevel(g.scoreRadarFinal)
      }))
    })

  } catch (error: any) {
    console.error("Erro no Radar Automático:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao processar radar" },
      { status: 500 }
    )
  }
}

// ==================== ENDPOINT PARA EXPORTAR LOGS ====================
export async function GET() {
  return NextResponse.json({
    success: true,
    totalLogs: performanceLogs.length,
    logs: performanceLogs.slice(-100) // Últimos 100 logs
  })
}

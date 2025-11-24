"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Radar, 
  Zap, 
  TrendingUp, 
  AlertCircle,
  Loader2,
  Trophy,
  ArrowLeft,
  Pin,
  Download,
  Play,
  Pause,
  Filter
} from "lucide-react"
import Link from "next/link"
import type { RadarGame } from "@/lib/radarLogic"
import { RADAR_LEAGUES } from "@/lib/radarLogic"

// Função para determinar nível de confiança
function getConfidenceLevel(score: number): { level: string; color: string } {
  if (score >= 90) return { level: "Elite", color: "text-purple-400" }
  if (score >= 80) return { level: "Alto", color: "text-emerald-400" }
  if (score >= 70) return { level: "Bom", color: "text-cyan-400" }
  if (score >= 60) return { level: "Acompanhar", color: "text-yellow-400" }
  return { level: "Sem Interesse", color: "text-slate-400" }
}

export default function RadarPage() {
  const [mode, setMode] = useState<"preLive" | "live">("live")
  const [selectedLeagues, setSelectedLeagues] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [games, setGames] = useState<RadarGame[]>([])
  const [selectedGame, setSelectedGame] = useState<RadarGame | null>(null)
  const [pinnedGames, setPinnedGames] = useState<Set<number>>(new Set())
  
  // Radar Automático
  const [autoMode, setAutoMode] = useState(false)
  const [scanInterval, setScanInterval] = useState(90) // segundos
  const [scanCount, setScanCount] = useState(0)
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const MAX_SCANS = 100
  const MAX_SESSION_HOURS = 12

  // Filtros visuais
  const [showFilters, setShowFilters] = useState(false)
  const [filterLowScore, setFilterLowScore] = useState(false)
  const [filterHighGoals, setFilterHighGoals] = useState(false)
  const [filterMinute, setFilterMinute] = useState<{ min: number; max: number } | null>(null)

  const handleLeagueToggle = (leagueId: number) => {
    setSelectedLeagues(prev => 
      prev.includes(leagueId)
        ? prev.filter(id => id !== leagueId)
        : [...prev, leagueId]
    )
  }

  const handleScan = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/radar-auto", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          mode,
          leagues: selectedLeagues.length > 0 ? selectedLeagues : undefined,
          minScoreRadar: 70,
          maxGames: 20
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Erro ao escanear jogos")
      }

      const result = await response.json()
      setGames(result.games || [])

      if (result.games.length === 0) {
        setError("Nenhum jogo encontrado com os critérios selecionados.")
      }

      // Incrementar contador de scans
      if (autoMode) {
        setScanCount(prev => prev + 1)
      }
    } catch (err: any) {
      setError(err.message || "Erro ao escanear jogos")
    } finally {
      setLoading(false)
    }
  }

  // Controle do Radar Automático
  const startAutoMode = () => {
    if (mode !== "live") {
      setError("Radar Automático só funciona no modo Live")
      return
    }

    if (selectedLeagues.length === 0) {
      setError("Selecione ao menos 1 liga para o Radar Automático")
      return
    }

    if (scanInterval < 60) {
      setError("Intervalo mínimo é 60 segundos")
      return
    }

    setAutoMode(true)
    setSessionStartTime(Date.now())
    setScanCount(0)
    setError(null)

    // Primeira varredura imediata
    handleScan()

    // Configurar intervalo
    intervalRef.current = setInterval(() => {
      handleScan()
    }, scanInterval * 1000)
  }

  const stopAutoMode = () => {
    setAutoMode(false)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  // Verificar limites de segurança
  useEffect(() => {
    if (!autoMode || !sessionStartTime) return

    const checkLimits = () => {
      const elapsed = Date.now() - sessionStartTime
      const hoursElapsed = elapsed / (1000 * 60 * 60)

      if (scanCount >= MAX_SCANS || hoursElapsed >= MAX_SESSION_HOURS) {
        stopAutoMode()
        setError(`Radar automático pausado por segurança (limites atingidos: ${scanCount} varreduras, ${hoursElapsed.toFixed(1)}h)`)
      }
    }

    const limitCheckInterval = setInterval(checkLimits, 10000) // Verificar a cada 10s

    return () => clearInterval(limitCheckInterval)
  }, [autoMode, sessionStartTime, scanCount])

  // Limpar intervalo ao desmontar
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Desativar auto mode ao trocar de modo
  useEffect(() => {
    if (mode !== "live" && autoMode) {
      stopAutoMode()
    }
  }, [mode])

  // Fixar/Desfixar jogo
  const togglePin = (fixtureId: number) => {
    setPinnedGames(prev => {
      const newSet = new Set(prev)
      if (newSet.has(fixtureId)) {
        newSet.delete(fixtureId)
      } else {
        newSet.add(fixtureId)
      }
      return newSet
    })
  }

  // Aplicar filtros
  const filteredGames = games.filter(game => {
    // Filtro de placares baixos
    if (filterLowScore) {
      const totalGoals = game.scoreHome + game.scoreAway
      if (totalGoals > 2) return false
    }

    // Filtro de jogos com muitos gols
    if (filterHighGoals) {
      const totalGoals = game.scoreHome + game.scoreAway
      if (totalGoals > 3) return false
    }

    // Filtro de minuto
    if (filterMinute && mode === "live") {
      if (game.minute < filterMinute.min || game.minute > filterMinute.max) {
        return false
      }
    }

    return true
  })

  // Ordenar: fixados primeiro, depois por score
  const sortedGames = [...filteredGames].sort((a, b) => {
    const aIsPinned = pinnedGames.has(a.fixtureId)
    const bIsPinned = pinnedGames.has(b.fixtureId)

    if (aIsPinned && !bIsPinned) return -1
    if (!aIsPinned && bIsPinned) return 1

    return b.scoreRadarFinal - a.scoreRadarFinal
  })

  // Exportar dados
  const exportData = (format: "json" | "csv") => {
    if (games.length === 0) {
      alert("Nenhum dado para exportar")
      return
    }

    const dataToExport = games.map(game => {
      const confidence = getConfidenceLevel(game.scoreRadarFinal)
      return {
        fixtureId: game.fixtureId,
        liga: game.leagueName,
        mandante: game.homeTeam,
        visitante: game.awayTeam,
        placar: `${game.scoreHome}-${game.scoreAway}`,
        minuto: game.minute,
        scoreRadarFinal: game.scoreRadarFinal,
        confidenceLevel: confidence.level,
        goldSignal: game.goldSignal ? "SIM" : "NÃO",
        criterios: game.criteriosQueBateram.join("; ")
      }
    })

    if (format === "json") {
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `radar-filtro-campeao-${Date.now()}.json`
      a.click()
    } else {
      // CSV
      const headers = Object.keys(dataToExport[0]).join(",")
      const rows = dataToExport.map(row => Object.values(row).join(","))
      const csv = [headers, ...rows].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `radar-filtro-campeao-${Date.now()}.csv`
      a.click()
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Filtro Campeão
            </Button>
          </Link>
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent flex items-center justify-center gap-3">
              <Radar className="w-10 h-10 text-purple-400" />
              Radar Automático Pro
            </h1>
            <p className="text-sm md:text-base text-slate-400">
              Escaneia automaticamente as 5 melhores ligas para Handicap Asiático Positivo
            </p>
          </div>
        </div>

        {/* Controles */}
        <Card className="mb-6 bg-slate-900/60 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-slate-100">
              <Zap className="w-5 h-5 text-yellow-400" />
              Configurações do Radar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Modo */}
            <div>
              <Label className="text-base text-slate-100 mb-3 block">Modo de Escaneamento</Label>
              <div className="flex gap-3">
                <Button
                  variant={mode === "live" ? "default" : "outline"}
                  onClick={() => setMode("live")}
                  className={mode === "live" ? "bg-purple-600 hover:bg-purple-700" : ""}
                  disabled={autoMode}
                >
                  🔴 Jogos ao Vivo
                </Button>
                <Button
                  variant={mode === "preLive" ? "default" : "outline"}
                  onClick={() => setMode("preLive")}
                  className={mode === "preLive" ? "bg-cyan-600 hover:bg-cyan-700" : ""}
                  disabled={autoMode}
                >
                  📅 Jogos de Hoje (Pré-Live)
                </Button>
              </div>
            </div>

            <Separator className="bg-slate-700" />

            {/* Ligas */}
            <div>
              <Label className="text-base text-slate-100 mb-3 block">
                Ligas (deixe em branco para todas)
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {RADAR_LEAGUES.map(league => (
                  <div key={league.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`league-${league.id}`}
                      checked={selectedLeagues.includes(league.id)}
                      onCheckedChange={() => handleLeagueToggle(league.id)}
                      disabled={autoMode}
                    />
                    <Label
                      htmlFor={`league-${league.id}`}
                      className="text-sm text-slate-300 cursor-pointer flex items-center gap-2"
                    >
                      {league.name}
                      <Badge variant="secondary" className="text-xs">
                        Peso: {league.weight.toFixed(2)}
                      </Badge>
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <Separator className="bg-slate-700" />

            {/* Radar Automático */}
            {mode === "live" && (
              <div className="space-y-3">
                <Label className="text-base text-slate-100 mb-3 block">
                  Modo Radar Automático (Live)
                </Label>
                <div className="flex items-center gap-3">
                  <Label className="text-sm text-slate-300">Intervalo (segundos):</Label>
                  <Input
                    type="number"
                    min={60}
                    max={300}
                    value={scanInterval}
                    onChange={(e) => setScanInterval(Number(e.target.value))}
                    disabled={autoMode}
                    className="w-24"
                  />
                  <span className="text-xs text-slate-400">(mín: 60s, recomendado: 90-120s)</span>
                </div>
                <div className="flex items-center gap-3">
                  {!autoMode ? (
                    <Button
                      onClick={startAutoMode}
                      className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={selectedLeagues.length === 0}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Iniciar Radar Automático
                    </Button>
                  ) : (
                    <Button
                      onClick={stopAutoMode}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      <Pause className="w-4 h-4 mr-2" />
                      Pausar Radar Automático
                    </Button>
                  )}
                </div>
                {autoMode && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3">
                    <p className="text-sm text-emerald-200">
                      🟢 Radar Automático ATIVO - Varreduras: {scanCount}/{MAX_SCANS} | 
                      Tempo: {sessionStartTime ? ((Date.now() - sessionStartTime) / (1000 * 60)).toFixed(0) : 0}min/{MAX_SESSION_HOURS * 60}min
                    </p>
                  </div>
                )}
              </div>
            )}

            <Separator className="bg-slate-700" />

            {/* Botão Escanear Manual */}
            <Button
              onClick={handleScan}
              disabled={loading || autoMode}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
                  <Radar className="w-5 h-5 mr-2" />
                  Escanear Agora
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Erro */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200">{error}</p>
          </div>
        )}

        {/* Filtros e Exportação */}
        {games.length > 0 && (
          <Card className="mb-6 bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-lg text-slate-100">
                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-cyan-400" />
                  Filtros e Exportação
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                >
                  {showFilters ? "Ocultar" : "Mostrar"}
                </Button>
              </CardTitle>
            </CardHeader>
            {showFilters && (
              <CardContent className="space-y-4">
                {/* Filtros */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-low-score"
                      checked={filterLowScore}
                      onCheckedChange={(checked) => setFilterLowScore(checked as boolean)}
                    />
                    <Label htmlFor="filter-low-score" className="text-sm text-slate-300 cursor-pointer">
                      Apenas placares com ≤2 gols
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="filter-high-goals"
                      checked={filterHighGoals}
                      onCheckedChange={(checked) => setFilterHighGoals(checked as boolean)}
                    />
                    <Label htmlFor="filter-high-goals" className="text-sm text-slate-300 cursor-pointer">
                      Ocultar jogos com +3 gols
                    </Label>
                  </div>
                </div>

                {mode === "live" && (
                  <div className="flex items-center gap-3">
                    <Label className="text-sm text-slate-300">Filtro de Minuto:</Label>
                    <Input
                      type="number"
                      placeholder="Min"
                      className="w-20"
                      onChange={(e) => {
                        const min = Number(e.target.value)
                        setFilterMinute(prev => prev ? { ...prev, min } : { min, max: 90 })
                      }}
                    />
                    <span className="text-slate-400">até</span>
                    <Input
                      type="number"
                      placeholder="Max"
                      className="w-20"
                      onChange={(e) => {
                        const max = Number(e.target.value)
                        setFilterMinute(prev => prev ? { ...prev, max } : { min: 0, max })
                      }}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFilterMinute(null)}
                    >
                      Limpar
                    </Button>
                  </div>
                )}

                <Separator className="bg-slate-700" />

                {/* Exportação */}
                <div className="flex gap-3">
                  <Button
                    onClick={() => exportData("json")}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar JSON
                  </Button>
                  <Button
                    onClick={() => exportData("csv")}
                    variant="outline"
                    size="sm"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Resultados */}
        {sortedGames.length > 0 && (
          <Card className="mb-6 bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg text-slate-100">
                <TrendingUp className="w-5 h-5 text-emerald-400" />
                Melhores Jogos Encontrados ({sortedGames.length})
              </CardTitle>
              <CardDescription className="text-slate-400">
                Ordenados por Score Radar (melhor → pior) | Fixados aparecem no topo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {sortedGames.map((game, idx) => {
                  const isPinned = pinnedGames.has(game.fixtureId)
                  const confidence = getConfidenceLevel(game.scoreRadarFinal)

                  return (
                    <div
                      key={game.fixtureId}
                      className={`bg-slate-800 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        game.goldSignal
                          ? "border-yellow-500/50 hover:border-yellow-500"
                          : "border-slate-700 hover:border-slate-600"
                      } ${selectedGame?.fixtureId === game.fixtureId ? "ring-2 ring-purple-500" : ""} ${
                        isPinned ? "ring-2 ring-cyan-500" : ""
                      }`}
                      onClick={() => setSelectedGame(game)}
                    >
                      {/* Header do Jogo */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              togglePin(game.fixtureId)
                            }}
                            className={isPinned ? "text-cyan-400" : "text-slate-400"}
                          >
                            <Pin className="w-4 h-4" />
                          </Button>
                          <Badge variant="secondary" className="text-xs">
                            #{idx + 1}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {game.leagueName}
                          </Badge>
                          {game.goldSignal && (
                            <Badge className="bg-yellow-500 text-black text-xs">
                              <Trophy className="w-3 h-3 mr-1" />
                              GOLD SIGNAL
                            </Badge>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-emerald-400">
                            {game.scoreRadarFinal}
                          </p>
                          <p className={`text-xs font-semibold ${confidence.color}`}>
                            {confidence.level}
                          </p>
                        </div>
                      </div>

                      {/* Times e Placar */}
                      <div className="mb-3">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-slate-100">{game.homeTeam}</p>
                          <p className="text-lg font-bold text-slate-100">
                            {game.scoreHome} - {game.scoreAway}
                          </p>
                          <p className="font-semibold text-slate-100">{game.awayTeam}</p>
                        </div>
                        {mode === "live" && (
                          <p className="text-center text-xs text-slate-400 mt-1">
                            Minuto: {game.minute}'
                          </p>
                        )}
                      </div>

                      {/* Estatísticas Resumidas */}
                      {mode === "live" && (
                        <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                          <div className="bg-slate-900 p-2 rounded text-center">
                            <p className="text-slate-400">RDS</p>
                            <p className="font-bold text-slate-100">
                              {game.stats.rdsHome} - {game.stats.rdsAway}
                            </p>
                          </div>
                          <div className="bg-slate-900 p-2 rounded text-center">
                            <p className="text-slate-400">Finalizações</p>
                            <p className="font-bold text-slate-100">
                              {game.stats.home.totalShots} - {game.stats.away.totalShots}
                            </p>
                          </div>
                          <div className="bg-slate-900 p-2 rounded text-center">
                            <p className="text-slate-400">No Alvo</p>
                            <p className="font-bold text-slate-100">
                              {game.stats.home.shotsOnTarget} - {game.stats.away.shotsOnTarget}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Odds */}
                      {game.odds && (
                        <div className="flex items-center justify-center gap-4 text-xs mb-3">
                          <div>
                            <p className="text-slate-400">Casa</p>
                            <p className="font-bold text-slate-100">{game.odds.home.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Empate</p>
                            <p className="font-bold text-slate-100">{game.odds.draw.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-slate-400">Fora</p>
                            <p className="font-bold text-slate-100">{game.odds.away.toFixed(2)}</p>
                          </div>
                        </div>
                      )}

                      {/* Critérios */}
                      <div className="flex flex-wrap gap-1">
                        {game.criteriosQueBateram.slice(0, 5).map((criterio, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {criterio}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Detalhes do Jogo Selecionado */}
        {selectedGame && mode === "live" && (
          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg text-slate-100">
                Análise Detalhada: {selectedGame.homeTeam} vs {selectedGame.awayTeam}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Estatísticas Completas */}
              <div>
                <h4 className="font-semibold mb-3 text-slate-100">Estatísticas Completas</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-800 p-3 rounded">
                    <p className="text-xs text-slate-400 mb-2">Casa</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-100">RDS: <span className="font-bold">{selectedGame.stats.rdsHome}</span></p>
                      <p className="text-slate-100">Finalizações: <span className="font-bold">{selectedGame.stats.home.totalShots}</span></p>
                      <p className="text-slate-100">No Alvo: <span className="font-bold">{selectedGame.stats.home.shotsOnTarget}</span></p>
                      <p className="text-slate-100">Posse: <span className="font-bold">{selectedGame.stats.home.possession}%</span></p>
                      <p className="text-slate-100">Escanteios: <span className="font-bold">{selectedGame.stats.home.corners}</span></p>
                    </div>
                  </div>
                  <div className="bg-slate-800 p-3 rounded">
                    <p className="text-xs text-slate-400 mb-2">Fora</p>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-100">RDS: <span className="font-bold">{selectedGame.stats.rdsAway}</span></p>
                      <p className="text-slate-100">Finalizações: <span className="font-bold">{selectedGame.stats.away.totalShots}</span></p>
                      <p className="text-slate-100">No Alvo: <span className="font-bold">{selectedGame.stats.away.shotsOnTarget}</span></p>
                      <p className="text-slate-100">Posse: <span className="font-bold">{selectedGame.stats.away.possession}%</span></p>
                      <p className="text-slate-100">Escanteios: <span className="font-bold">{selectedGame.stats.away.corners}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="bg-slate-700" />

              {/* Botão para Análise Completa */}
              <div className="text-center">
                <p className="text-sm text-slate-400 mb-3">
                  Para análise completa com os 33 critérios, use o módulo HT → FT do Filtro Campeão
                </p>
                <Link href={`/?fixtureId=${selectedGame.fixtureId}`}>
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    Abrir Análise Completa
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

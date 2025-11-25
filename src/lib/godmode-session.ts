// ==================== GODMODE SESSION MANAGER ====================
// Sistema de gerenciamento de sessão para conectar análises GODMODE ao Assistente Tático Pro

export interface MomentumData {
  last5min: number
  last10min: number
  last15min: number
  trend: "crescendo" | "neutro" | "caindo"
}

export interface PressureData {
  pressureIndex: number
  isHotMoment: boolean
  occasions: string[]
}

export interface GodmodeAnalysisData {
  // Identificação do jogo
  fixtureId: number
  homeTeam: string
  awayTeam: string
  league: string
  score: string
  minute: number
  
  // Linha e Odd
  haLine: string
  haOdd: number
  
  // Métricas principais
  ev: number
  confidence: number
  recommendation: string
  
  // xG
  xgHome: number
  xgAway: number
  shadowXG: number
  
  // Momentum e Pressão
  momentum: MomentumData
  pressureIndex: PressureData
  
  // RDS
  rdsCasa: number
  rdsFora: number
  
  // Módulos GODMODE
  timeBombActive: boolean
  deadGameDetected: boolean
  patternBreak: "nenhum" | "leve" | "forte"
  riskMapType: "explosive" | "controlled" | "chaotic" | "locked" | "dead"
  htToFtCoherence?: "ROTEIRO CONFIRMADO" | "NEUTRO" | "ROTEIRO ROMPIDO"
  
  // AggroLevel
  aggroLevel: number
  aggroLevelName: string
  
  // vGODMODE 3.0
  greenLightActive: boolean
  deadZoneActive: boolean
  scoreShieldActive: boolean
  timingScore: number
  mirrorCheckActive: boolean
  mirrorCheckArchetype?: string
  
  // OPC
  opcStatus: "ATIVO ✓" | "OFF ✗" | "CONDICIONAL ⚠"
  opcMessage: string
  
  // Estatísticas detalhadas
  stats: {
    shotsTotalHome: number
    shotsTotalAway: number
    shotsOnTargetHome: number
    shotsOnTargetAway: number
    dangerousAttacksHome: number
    dangerousAttacksAway: number
    possessionHome: number
    possessionAway: number
    cornersHome: number
    cornersAway: number
    yellowHome: number
    yellowAway: number
    redHome: number
    redAway: number
  }
  
  // Metadados
  timestamp: number
  analysisType: "Pré-Jogo" | "HT→FT" | "HT Snapshot"
}

const STORAGE_KEY = "godmode_analysis"
const EXPIRATION_TIME = 4 * 60 * 60 * 1000 // 4 horas

export class GodmodeSession {
  /**
   * Salva uma análise GODMODE na sessão
   */
  static saveAnalysis(data: GodmodeAnalysisData): void {
    if (typeof window === "undefined") return
    
    try {
      const sessionData = {
        ...data,
        timestamp: Date.now()
      }
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData))
      console.log("✅ Análise GODMODE salva na sessão:", sessionData)
    } catch (error) {
      console.error("❌ Erro ao salvar análise GODMODE:", error)
    }
  }
  
  /**
   * Carrega a análise GODMODE da sessão
   */
  static loadAnalysis(): GodmodeAnalysisData | null {
    if (typeof window === "undefined") return null
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) return null
      
      const data: GodmodeAnalysisData = JSON.parse(stored)
      
      // Verificar se a análise expirou
      const age = Date.now() - data.timestamp
      if (age > EXPIRATION_TIME) {
        console.warn("⚠️ Análise GODMODE expirada (>4h)")
        this.clearAnalysis()
        return null
      }
      
      console.log("✅ Análise GODMODE carregada:", data)
      return data
    } catch (error) {
      console.error("❌ Erro ao carregar análise GODMODE:", error)
      return null
    }
  }
  
  /**
   * Verifica se existe uma análise válida
   */
  static hasValidAnalysis(): boolean {
    return this.loadAnalysis() !== null
  }
  
  /**
   * Limpa a análise da sessão
   */
  static clearAnalysis(): void {
    if (typeof window === "undefined") return
    
    try {
      localStorage.removeItem(STORAGE_KEY)
      console.log("🗑️ Análise GODMODE removida da sessão")
    } catch (error) {
      console.error("❌ Erro ao limpar análise GODMODE:", error)
    }
  }
  
  /**
   * Valida consistência entre análises (1T vs 2T)
   */
  static validateConsistency(newData: GodmodeAnalysisData): {
    valid: boolean
    message?: string
  } {
    const currentData = this.loadAnalysis()
    
    if (!currentData) {
      return { valid: true }
    }
    
    // Verificar se é o mesmo jogo
    const sameGame = 
      currentData.homeTeam === newData.homeTeam &&
      currentData.awayTeam === newData.awayTeam &&
      currentData.fixtureId === newData.fixtureId
    
    if (!sameGame) {
      return {
        valid: false,
        message: "❌ As análises detectadas pertencem a jogos diferentes. Execute leitura do mesmo jogo para ativar a comparação HT→FT."
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Obtém informações resumidas da análise
   */
  static getSummary(): string | null {
    const data = this.loadAnalysis()
    if (!data) return null
    
    return `${data.homeTeam} ${data.score} ${data.awayTeam} — ${data.minute}' | AggroLevel ${data.aggroLevel} | Confiança ${data.confidence.toFixed(0)}%`
  }
  
  /**
   * Verifica se a análise é recente (< 30 minutos)
   */
  static isRecent(): boolean {
    const data = this.loadAnalysis()
    if (!data) return false
    
    const age = Date.now() - data.timestamp
    return age < 30 * 60 * 1000 // 30 minutos
  }
}

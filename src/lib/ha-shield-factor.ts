// ==================== HA SHIELD FACTOR ====================
// Camada complementar para tratamento avançado do Handicap Asiático Positivo
// NÃO substitui lógica existente - apenas adiciona fator de proteção

/**
 * Tabela fixa de fatores de proteção por linha HA+
 */
export const HA_SHIELD_FACTORS: Record<string, number> = {
  "+0.25": 0.02,
  "+0.5": 0.05,
  "+0.50": 0.05,
  "+0.75": 0.07,
  "+1.0": 0.09,
  "+1.00": 0.09,
  "+1.25": 0.11,
  "+1.5": 0.13,
  "+1.50": 0.13,
  "+2.0": 0.16,
  "+2.00": 0.16
}

/**
 * Obtém o fator de proteção para uma linha HA+
 */
export function getHAShieldFactor(haLine: string): number {
  // Normalizar linha (remover espaços, garantir formato)
  const normalized = haLine.trim().replace(/\s+/g, "")
  
  // Buscar fator exato
  if (HA_SHIELD_FACTORS[normalized]) {
    return HA_SHIELD_FACTORS[normalized]
  }
  
  // Tentar extrair número e buscar variações
  const match = normalized.match(/([+-]?\d+\.?\d*)/)
  if (match) {
    const value = match[1]
    // Tentar com +
    if (HA_SHIELD_FACTORS[`+${value}`]) {
      return HA_SHIELD_FACTORS[`+${value}`]
    }
  }
  
  // Se não encontrar, retornar 0 (sem proteção adicional)
  return 0
}

/**
 * Aplica o HA Shield Factor à probabilidade real
 * Limite máximo: 80%
 */
export function applyHAShieldFactor(
  probabilidadeReal: number,
  haLine: string
): number {
  const shieldFactor = getHAShieldFactor(haLine)
  const probabilidadeAjustada = probabilidadeReal + shieldFactor
  
  // Limite máximo de 80%
  return Math.min(0.80, probabilidadeAjustada)
}

/**
 * Regimes de decisão baseados na linha HA+
 */
export type HARegime = "A" | "B" | "C"

export interface HARegimeRequirements {
  regime: HARegime
  name: string
  evMin: number
  haFriendlyRequired: boolean
  riskMapAllowed: string[]
  momentumMin: number
  description: string
}

/**
 * Determina o regime de decisão baseado na linha HA+
 */
export function getHARegime(haLine: string): HARegimeRequirements {
  const normalized = haLine.trim().replace(/\s+/g, "")
  
  // Regime A — HA Apertado (+0.25 / +0.5)
  if (normalized === "+0.25" || normalized === "+0.5" || normalized === "+0.50") {
    return {
      regime: "A",
      name: "HA Apertado",
      evMin: 3,
      haFriendlyRequired: true,
      riskMapAllowed: ["explosive", "controlled", "chaotic", "locked"],
      momentumMin: 30,
      description: "Exigências altas: EV ≥ +3%, HA Friendly = SIM, Sem Risk Map DEAD, Momentum ≥ 30"
    }
  }
  
  // Regime B — HA Intermediário (+0.75 / +1.0)
  if (normalized === "+0.75" || normalized === "+1.0" || normalized === "+1.00") {
    return {
      regime: "B",
      name: "HA Intermediário",
      evMin: 0,
      haFriendlyRequired: false,
      riskMapAllowed: ["explosive", "controlled", "chaotic", "locked"],
      momentumMin: 0,
      description: "Exigências moderadas: EV ≥ 0%, Jogo não descontrolado, Mapa defensivo aceitável"
    }
  }
  
  // Regime C — HA Escudo Pesado (+1.25 / +1.5 / +2.0)
  if (
    normalized === "+1.25" || 
    normalized === "+1.5" || normalized === "+1.50" ||
    normalized === "+2.0" || normalized === "+2.00"
  ) {
    return {
      regime: "C",
      name: "HA Escudo Pesado",
      evMin: -2, // Pode ser neutro ou levemente positivo (0% ~ +2%)
      haFriendlyRequired: false,
      riskMapAllowed: ["explosive", "controlled", "chaotic", "locked", "dead"],
      momentumMin: 0,
      description: "Exigências flexíveis: EV neutro/levemente positivo, Jogo travado OK, Shadow xG baixo"
    }
  }
  
  // Fallback: Regime B (padrão)
  return {
    regime: "B",
    name: "HA Intermediário (Padrão)",
    evMin: 0,
    haFriendlyRequired: false,
    riskMapAllowed: ["explosive", "controlled", "chaotic", "locked"],
    momentumMin: 0,
    description: "Regime padrão para linhas não mapeadas"
  }
}

/**
 * Ajusta Green Light baseado no regime HA+
 */
export function adjustGreenLightForHA(
  haLine: string,
  ev: number,
  haFriendly: boolean,
  riskMapType: string,
  shadowXG: number,
  jogoTravado: boolean
): {
  approved: boolean
  reason: string
} {
  const regime = getHARegime(haLine)
  const normalized = haLine.trim().replace(/\s+/g, "")
  
  // Regime A — HA Apertado (+0.25 / +0.5)
  if (regime.regime === "A") {
    if (normalized === "+0.5" || normalized === "+0.50") {
      // Linha +0.5: exigir EV+ ≥ 3% e cenário muito favorável
      if (ev < 3) {
        return {
          approved: false,
          reason: `Regime A (+0.5): EV insuficiente (${ev.toFixed(1)}% < 3%)`
        }
      }
      if (!haFriendly) {
        return {
          approved: false,
          reason: "Regime A (+0.5): HA Friendly não ativo - contexto não limpo"
        }
      }
    }
    
    // Verificações gerais Regime A
    if (ev < regime.evMin) {
      return {
        approved: false,
        reason: `Regime A: EV insuficiente (${ev.toFixed(1)}% < ${regime.evMin}%)`
      }
    }
    
    if (regime.haFriendlyRequired && !haFriendly) {
      return {
        approved: false,
        reason: "Regime A: HA Friendly obrigatório não ativo"
      }
    }
    
    if (!regime.riskMapAllowed.includes(riskMapType)) {
      return {
        approved: false,
        reason: `Regime A: Risk Map ${riskMapType} não permitido`
      }
    }
    
    return {
      approved: true,
      reason: "Regime A: Todos os critérios atendidos"
    }
  }
  
  // Regime B — HA Intermediário (+0.75 / +1.0)
  if (regime.regime === "B") {
    if (normalized === "+1.0" || normalized === "+1.00") {
      // Linha +1.0: aceitar EV entre 0% e +3% se contexto forte
      if (ev >= 0 && ev <= 3) {
        // Verificar contexto forte
        const contextoForte = shadowXG < 0.3 && riskMapType !== "chaotic"
        if (!contextoForte) {
          return {
            approved: false,
            reason: "Regime B (+1.0): EV baixo requer contexto forte (Shadow xG baixo + jogo não caótico)"
          }
        }
      }
    }
    
    if (ev < regime.evMin) {
      return {
        approved: false,
        reason: `Regime B: EV insuficiente (${ev.toFixed(1)}% < ${regime.evMin}%)`
      }
    }
    
    if (riskMapType === "chaotic" && shadowXG > 0.5) {
      return {
        approved: false,
        reason: "Regime B: Jogo descontrolado com Shadow xG crítico"
      }
    }
    
    return {
      approved: true,
      reason: "Regime B: Critérios atendidos"
    }
  }
  
  // Regime C — HA Escudo Pesado (+1.25 / +1.5 / +2.0)
  if (regime.regime === "C") {
    if (normalized === "+1.5" || normalized === "+1.50") {
      // Linha +1.5: aceitar EV levemente positivo ou neutro (0% a +2%) em jogos travados
      if (ev >= 0 && ev <= 2) {
        if (!jogoTravado || shadowXG > 0.4) {
          return {
            approved: false,
            reason: "Regime C (+1.5): EV baixo requer jogo travado e Shadow xG baixo"
          }
        }
      }
    }
    
    // Regime C é mais flexível
    if (ev < regime.evMin) {
      return {
        approved: false,
        reason: `Regime C: EV muito negativo (${ev.toFixed(1)}% < ${regime.evMin}%)`
      }
    }
    
    // Verificar se jogo está adequado para escudo pesado
    if (shadowXG > 0.6) {
      return {
        approved: false,
        reason: "Regime C: Shadow xG muito alto - risco elevado mesmo com escudo"
      }
    }
    
    return {
      approved: true,
      reason: "Regime C: Escudo pesado ativo - critérios flexíveis atendidos"
    }
  }
  
  return {
    approved: false,
    reason: "Regime não identificado"
  }
}

/**
 * Ajusta Score Shield baseado no regime HA+
 */
export function adjustScoreShieldForHA(
  haLine: string,
  shadowXG: number,
  mapaDefensivoSolido: boolean,
  timeSegurando: boolean
): {
  shouldActivate: boolean
  reason: string
} {
  const regime = getHARegime(haLine)
  const normalized = haLine.trim().replace(/\s+/g, "")
  
  // Ativar mais facilmente quando linha ≥ +1.0
  if (
    normalized === "+1.0" || normalized === "+1.00" ||
    normalized === "+1.25" ||
    normalized === "+1.5" || normalized === "+1.50" ||
    normalized === "+2.0" || normalized === "+2.00"
  ) {
    // Verificar condições
    if (shadowXG < 0.3 && mapaDefensivoSolido) {
      return {
        shouldActivate: true,
        reason: `Score Shield ativado (${regime.name}): Shadow xG baixo + mapa defensivo sólido`
      }
    }
    
    if (timeSegurando && shadowXG < 0.4) {
      return {
        shouldActivate: true,
        reason: `Score Shield ativado (${regime.name}): Time segurando + Shadow xG controlado`
      }
    }
  }
  
  return {
    shouldActivate: false,
    reason: "Condições para Score Shield não atendidas"
  }
}

/**
 * Ajusta Timing Score baseado no regime HA+
 */
export function adjustTimingScoreForHA(
  haLine: string,
  timingScoreBase: number,
  jogoTravado: boolean,
  semPressao: boolean
): number {
  const normalized = haLine.trim().replace(/\s+/g, "")
  let bonus = 0
  
  // Adicionar +5 pontos quando HA ≥ +1.0 em jogo travado
  if (
    (normalized === "+1.0" || normalized === "+1.00" ||
     normalized === "+1.25" ||
     normalized === "+1.5" || normalized === "+1.50" ||
     normalized === "+2.0" || normalized === "+2.00") &&
    jogoTravado
  ) {
    bonus += 5
  }
  
  // Adicionar +10 pontos quando HA ≥ +1.5 em jogo sem pressão
  if (
    (normalized === "+1.5" || normalized === "+1.50" ||
     normalized === "+2.0" || normalized === "+2.00") &&
    semPressao
  ) {
    bonus += 10
  }
  
  return timingScoreBase + bonus
}

/**
 * Ajusta HA Friendly baseado no regime HA+
 */
export function adjustHAFriendlyForHA(
  haLine: string,
  pressaoContra: number,
  contextoLimpo: boolean
): {
  approved: boolean
  reason: string
} {
  const normalized = haLine.trim().replace(/\s+/g, "")
  
  // Se linha ≥ +1.0, tolerar um pouco mais de pressão contra
  if (
    normalized === "+1.0" || normalized === "+1.00" ||
    normalized === "+1.25" ||
    normalized === "+1.5" || normalized === "+1.50" ||
    normalized === "+2.0" || normalized === "+2.00"
  ) {
    // Tolerar pressão até 70 (em vez de 60)
    if (pressaoContra <= 70) {
      return {
        approved: true,
        reason: `HA Friendly aprovado (linha ${normalized}): Pressão contra tolerável (${pressaoContra.toFixed(0)} ≤ 70)`
      }
    }
  }
  
  // Se linha = +0.5, exigir contexto mais limpo
  if (normalized === "+0.5" || normalized === "+0.50") {
    if (!contextoLimpo) {
      return {
        approved: false,
        reason: "HA Friendly bloqueado (linha +0.5): Contexto não suficientemente limpo"
      }
    }
    
    if (pressaoContra > 50) {
      return {
        approved: false,
        reason: `HA Friendly bloqueado (linha +0.5): Pressão contra alta (${pressaoContra.toFixed(0)} > 50)`
      }
    }
  }
  
  // Verificação padrão
  if (pressaoContra > 60) {
    return {
      approved: false,
      reason: `HA Friendly bloqueado: Pressão contra alta (${pressaoContra.toFixed(0)} > 60)`
    }
  }
  
  return {
    approved: true,
    reason: "HA Friendly aprovado: Contexto adequado"
  }
}

/**
 * Gera resumo do regime HA+ ativo
 */
export function getHARegimeSummary(haLine: string): string {
  const regime = getHARegime(haLine)
  const shieldFactor = getHAShieldFactor(haLine)
  
  return `🛡️ **${regime.name} (Regime ${regime.regime})**
Linha: ${haLine}
Shield Factor: +${(shieldFactor * 100).toFixed(0)}%
${regime.description}`
}

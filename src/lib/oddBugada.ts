// ==================== DETECÇÃO DE ODD BUGADA ====================

import { ODD_MIN, ODD_MAX } from "./filtroCampeaoConfig"

/**
 * Detecta se uma odd está "bugada" (fora dos padrões normais)
 * 
 * Critérios:
 * 1. Odd abaixo do mínimo profissional (ODD_MIN)
 * 2. Odd muito alta para probabilidade real alta (desbalanceamento)
 * 3. Odd muito baixa para probabilidade real baixa (desbalanceamento)
 */
export function detectOddBugada(odd: number, realProb: number): boolean {
  // Critério 1: Odd fora do range profissional
  if (odd < ODD_MIN || odd > ODD_MAX) {
    return true
  }
  
  // Critério 2: Probabilidade real alta (>65%) mas odd muito alta (>2.6)
  // Indica que o mercado está subestimando demais o time
  if (realProb > 65 && odd > 2.6) {
    return true
  }
  
  // Critério 3: Probabilidade real baixa (<35%) mas odd muito baixa (<1.6)
  // Indica que o mercado está superestimando o time
  if (realProb < 35 && odd < 1.6) {
    return true
  }
  
  // Critério 4: Desbalanceamento extremo entre odd e probabilidade
  const impliedProb = (1 / odd) * 100
  const probDiff = Math.abs(realProb - impliedProb)
  
  // Se diferença > 30%, pode ser odd bugada
  if (probDiff > 30) {
    return true
  }
  
  return false
}

/**
 * Retorna mensagem explicativa sobre a odd bugada
 */
export function getOddBugadaMessage(odd: number, realProb: number): string {
  if (odd < ODD_MIN) {
    return `Odd ${odd.toFixed(2)} está abaixo do mínimo profissional (${ODD_MIN.toFixed(2)})`
  }
  
  if (odd > ODD_MAX) {
    return `Odd ${odd.toFixed(2)} está acima do máximo profissional (${ODD_MAX.toFixed(2)})`
  }
  
  if (realProb > 65 && odd > 2.6) {
    return `Probabilidade real alta (${realProb.toFixed(1)}%) mas odd muito alta (${odd.toFixed(2)}) - mercado pode estar errado`
  }
  
  if (realProb < 35 && odd < 1.6) {
    return `Probabilidade real baixa (${realProb.toFixed(1)}%) mas odd muito baixa (${odd.toFixed(2)}) - mercado pode estar superestimando`
  }
  
  const impliedProb = (1 / odd) * 100
  const probDiff = Math.abs(realProb - impliedProb)
  
  if (probDiff > 30) {
    return `Desbalanceamento extremo: probabilidade real ${realProb.toFixed(1)}% vs implícita ${impliedProb.toFixed(1)}%`
  }
  
  return "Odd fora dos padrões normais"
}

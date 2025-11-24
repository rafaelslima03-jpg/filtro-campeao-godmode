// ==================== VALIDAÇÃO DE DADOS DE ENTRADA ====================

interface GameData {
  homeTeam: string
  awayTeam: string
  league: string
  homeOdd: number
  drawOdd: number
  awayOdd: number
  homeForm: string
  awayForm: string
}

/**
 * Valida dados de entrada do pré-jogo
 * Retorna array de strings de erro (vazio se tudo OK)
 * 
 * NOTA: xG NÃO é validado no pré-jogo (só usado no HT → FT Live)
 */
export function validateGameData(data: GameData): string[] {
  const errors: string[] = []
  
  // Validar times
  if (!data.homeTeam || data.homeTeam.trim().length === 0) {
    errors.push("Time mandante não informado")
  }
  
  if (!data.awayTeam || data.awayTeam.trim().length === 0) {
    errors.push("Time visitante não informado")
  }
  
  // Validar liga
  if (!data.league || data.league.trim().length === 0) {
    errors.push("Liga não informada")
  }
  
  // Validar odds
  if (!data.homeOdd || data.homeOdd <= 1) {
    errors.push("Odd do mandante inválida (deve ser > 1)")
  }
  
  if (!data.drawOdd || data.drawOdd <= 1) {
    errors.push("Odd do empate inválida (deve ser > 1)")
  }
  
  if (!data.awayOdd || data.awayOdd <= 1) {
    errors.push("Odd do visitante inválida (deve ser > 1)")
  }
  
  // Validar forma
  const validFormChars = /^[VED]*$/
  
  if (data.homeForm && !validFormChars.test(data.homeForm)) {
    errors.push("Forma do mandante inválida (use apenas V, E, D)")
  }
  
  if (data.awayForm && !validFormChars.test(data.awayForm)) {
    errors.push("Forma do visitante inválida (use apenas V, E, D)")
  }
  
  if (data.homeForm && data.homeForm.length > 10) {
    errors.push("Forma do mandante muito longa (máximo 10 jogos)")
  }
  
  if (data.awayForm && data.awayForm.length > 10) {
    errors.push("Forma do visitante muito longa (máximo 10 jogos)")
  }
  
  // Validar coerência das odds (soma das probabilidades implícitas)
  if (data.homeOdd > 0 && data.drawOdd > 0 && data.awayOdd > 0) {
    const totalImpliedProb = (1 / data.homeOdd + 1 / data.drawOdd + 1 / data.awayOdd) * 100
    
    // Margem da casa normalmente fica entre 102% e 115%
    if (totalImpliedProb < 100 || totalImpliedProb > 120) {
      errors.push(`Odds inconsistentes (margem da casa: ${totalImpliedProb.toFixed(1)}% - esperado: 102-115%)`)
    }
  }
  
  return errors
}

/**
 * Valida dados de entrada do HT → FT
 */
export function validateHTData(
  teamName: string,
  haLine: string,
  haOdd: number,
  minute: number
): string[] {
  const errors: string[] = []
  
  if (!teamName || teamName.trim().length === 0) {
    errors.push("Nome do time não informado")
  }
  
  if (!haLine || haLine.trim().length === 0) {
    errors.push("Linha do HA+ não informada")
  }
  
  if (!haOdd || haOdd <= 1) {
    errors.push("Odd do HA+ inválida (deve ser > 1)")
  }
  
  if (minute < 0 || minute > 120) {
    errors.push("Minuto inválido (deve estar entre 0 e 120)")
  }
  
  // Validar formato da linha HA+
  const validHALine = /^\+\d+(\.\d+)?$/
  if (haLine && !validHALine.test(haLine)) {
    errors.push("Formato da linha HA+ inválido (use +0.5, +1.0, etc.)")
  }
  
  return errors
}

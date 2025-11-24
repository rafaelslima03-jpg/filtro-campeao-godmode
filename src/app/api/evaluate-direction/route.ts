import { NextRequest, NextResponse } from "next/server"
import { evaluateDirectionForHaPlus } from "@/lib/directionEvaluation"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    
    const {
      htAnalysis,
      finalScore,
      shots,
      dangerousAttacks
    } = body
    
    // Validar dados
    if (!htAnalysis || !finalScore) {
      return NextResponse.json(
        { error: "Dados incompletos: htAnalysis e finalScore são obrigatórios" },
        { status: 400 }
      )
    }
    
    // Montar dados do full time
    const fullTimeData = {
      finalScore,
      shots: shots || { home: 0, away: 0 },
      dangerousAttacks: dangerousAttacks || { home: 0, away: 0 }
    }
    
    // Avaliar direção
    const evaluation = evaluateDirectionForHaPlus(htAnalysis, fullTimeData)
    
    return NextResponse.json({
      success: true,
      evaluation
    })
    
  } catch (error: any) {
    console.error("Erro ao avaliar direção:", error)
    return NextResponse.json(
      { error: error.message || "Erro ao avaliar direção" },
      { status: 500 }
    )
  }
}

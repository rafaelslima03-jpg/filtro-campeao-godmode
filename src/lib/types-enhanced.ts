/**
 * Tipos para dados enriquecidos da API-Football
 */

export interface Standing {
  rank: number
  team: {
    id: number
    name: string
    logo: string
  }
  points: number
  goalsDiff: number
  group: string
  form: string
  status: string
  description: string
  all: {
    played: number
    win: number
    draw: number
    lose: number
    goals: {
      for: number
      against: number
    }
  }
  home: {
    played: number
    win: number
    draw: number
    lose: number
  }
  away: {
    played: number
    win: number
    draw: number
    lose: number
  }
}

export interface H2HFixture {
  fixture: {
    id: number
    date: string
    timestamp: number
  }
  teams: {
    home: {
      id: number
      name: string
      winner: boolean | null
    }
    away: {
      id: number
      name: string
      winner: boolean | null
    }
  }
  goals: {
    home: number
    away: number
  }
  score: {
    halftime: {
      home: number
      away: number
    }
    fulltime: {
      home: number
      away: number
    }
  }
}

export interface MatchEvent {
  time: {
    elapsed: number
    extra: number | null
  }
  team: {
    id: number
    name: string
    logo: string
  }
  player: {
    id: number
    name: string
  }
  assist: {
    id: number | null
    name: string | null
  }
  type: "Goal" | "Card" | "subst" | "Var"
  detail: string
  comments: string | null
}

export interface Lineup {
  team: {
    id: number
    name: string
    logo: string
  }
  formation: string
  startXI: Array<{
    player: {
      id: number
      name: string
      number: number
      pos: string
      grid: string
    }
  }>
  substitutes: Array<{
    player: {
      id: number
      name: string
      number: number
      pos: string
    }
  }>
  coach: {
    id: number
    name: string
    photo: string
  }
}

export interface Injury {
  player: {
    id: number
    name: string
    photo: string
    type: string
    reason: string
  }
  team: {
    id: number
    name: string
    logo: string
  }
  fixture: {
    id: number
    date: string
  }
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string
    season: number
  }
}

export interface TopScorer {
  player: {
    id: number
    name: string
    firstname: string
    lastname: string
    age: number
    birth: {
      date: string
      place: string
      country: string
    }
    nationality: string
    height: string
    weight: string
    injured: boolean
    photo: string
  }
  statistics: Array<{
    team: {
      id: number
      name: string
      logo: string
    }
    league: {
      id: number
      name: string
      country: string
      logo: string
      flag: string
      season: number
    }
    games: {
      appearences: number
      lineups: number
      minutes: number
      number: number | null
      position: string
      rating: string
      captain: boolean
    }
    substitutes: {
      in: number
      out: number
      bench: number
    }
    shots: {
      total: number
      on: number
    }
    goals: {
      total: number
      conceded: number
      assists: number
      saves: number
    }
    passes: {
      total: number
      key: number
      accuracy: number
    }
  }>
}

export interface OddsBookmaker {
  id: number
  name: string
  bets: Array<{
    id: number
    name: string
    values: Array<{
      value: string
      odd: string
    }>
  }>
}

export interface Prediction {
  predictions: {
    winner: {
      id: number
      name: string
      comment: string
    }
    win_or_draw: boolean
    under_over: string | null
    goals: {
      home: string
      away: string
    }
    advice: string
    percent: {
      home: string
      draw: string
      away: string
    }
  }
  league: {
    id: number
    name: string
    country: string
    logo: string
    flag: string
    season: number
  }
  teams: {
    home: {
      id: number
      name: string
      logo: string
      last_5: {
        form: string
        att: string
        def: string
        goals: {
          for: {
            total: number
            average: string
          }
          against: {
            total: number
            average: string
          }
        }
      }
    }
    away: {
      id: number
      name: string
      logo: string
      last_5: {
        form: string
        att: string
        def: string
        goals: {
          for: {
            total: number
            average: string
          }
          against: {
            total: number
            average: string
          }
        }
      }
    }
  }
  comparison: {
    form: {
      home: string
      away: string
    }
    att: {
      home: string
      away: string
    }
    def: {
      home: string
      away: string
    }
    poisson_distribution: {
      home: string
      away: string
    }
    h2h: {
      home: string
      away: string
    }
    goals: {
      home: string
      away: string
    }
    total: {
      home: string
      away: string
    }
  }
}

export interface EnhancedData {
  standings: Standing[] | null
  h2h: H2HFixture[] | null
  events: MatchEvent[] | null
  lineups: Lineup[] | null
  injuries: Injury[] | null
  topscorers: TopScorer[] | null
  odds: Array<{
    league: any
    fixture: any
    update: string
    bookmakers: OddsBookmaker[]
  }> | null
  predictions: Prediction | null
}

export interface HTSummaryEnhanced {
  fixtureId: number
  homeTeam: string
  awayTeam: string
  homeTeamId: number
  awayTeamId: number
  leagueId: number
  season: number
  halftimeScore: string
  shotsTotalHome: number
  shotsOnTargetHome: number
  shotsTotalAway: number
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
  enhanced?: EnhancedData
}

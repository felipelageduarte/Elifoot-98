import type { GameState, MatchResult, MatchStats } from './types'

export function makeEmptyStats(season: number, round: number): MatchStats {
  return {
    since: { season, round },
    games: 0,
    homeGoals: 0,
    awayGoals: 0,
    homeWins: 0,
    draws: 0,
    awayWins: 0,
    goallessGames: 0,
    yellowCards: 0,
    redCards: 0,
    penaltiesAwarded: 0,
    penaltiesScored: 0,
    injuries: 0,
  }
}

// Acumula uma partida realmente jogada. Jogos em campo neutro (final da
// Taça) ficam de fora — mando de campo não se aplica a eles.
export function recordMatchStats(stats: MatchStats, result: MatchResult) {
  if (result.neutral) return
  stats.games++
  stats.homeGoals += result.homeGoals
  stats.awayGoals += result.awayGoals
  if (result.homeGoals > result.awayGoals) stats.homeWins++
  else if (result.homeGoals < result.awayGoals) stats.awayWins++
  else stats.draws++
  if (result.homeGoals + result.awayGoals === 0) stats.goallessGames++
  stats.yellowCards += result.yellowCards
  stats.redCards += result.redCards
  stats.penaltiesAwarded += result.penaltiesAwarded
  stats.penaltiesScored += result.penaltiesScored
  stats.injuries += result.injuries
}

export function resetStats(state: GameState) {
  state.stats = makeEmptyStats(state.season, state.currentMatchday + 1)
}

export interface DerivedStats {
  avgGoals: number
  avgHomeGoals: number
  avgAwayGoals: number
  homeWinPct: number
  drawPct: number
  awayWinPct: number
  goallessPct: number
  avgYellow: number
  avgRed: number
  avgPenalties: number
  penaltyConversionPct: number
  avgInjuries: number
}

export function deriveStats(stats: MatchStats): DerivedStats | null {
  if (stats.games === 0) return null
  const g = stats.games
  return {
    avgGoals: (stats.homeGoals + stats.awayGoals) / g,
    avgHomeGoals: stats.homeGoals / g,
    avgAwayGoals: stats.awayGoals / g,
    homeWinPct: (stats.homeWins / g) * 100,
    drawPct: (stats.draws / g) * 100,
    awayWinPct: (stats.awayWins / g) * 100,
    goallessPct: (stats.goallessGames / g) * 100,
    avgYellow: stats.yellowCards / g,
    avgRed: stats.redCards / g,
    avgPenalties: stats.penaltiesAwarded / g,
    penaltyConversionPct: stats.penaltiesAwarded > 0 ? (stats.penaltiesScored / stats.penaltiesAwarded) * 100 : 0,
    avgInjuries: stats.injuries / g,
  }
}

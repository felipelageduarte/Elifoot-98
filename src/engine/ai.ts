import type { GameState, Position, Team } from './types'
import { defaultLineup, makeFreePlayer, strengthFromLevel } from './newgame'
import { playerValue, salaryDemand, canBuy } from './transfers'
import { repay } from './finance'
import { rand, randInt } from './rng'
import { DIVISION_LEVEL } from '../data/teams'

// Categoria de base: repõe elenco encolhido (evita clube sem time)
export function promoteJuniors(state: GameState, team: Team): string[] {
  const promoted: string[] = []
  const need = (pos: Position, min: number) => Math.max(0, min - team.players.filter((p) => p.pos === pos).length)
  const wanted: [Position, number][] = [
    ['G', need('G', 2)],
    ['D', need('D', 5)],
    ['M', need('M', 5)],
    ['A', need('A', 3)],
  ]
  for (const [pos, count] of wanted) {
    for (let i = 0; i < count; i++) {
      const level = DIVISION_LEVEL[Math.min(team.division, 4) - 1]
      const junior = makeFreePlayer(pos, strengthFromLevel(Math.max(1, level - 2), pos))
      junior.age = randInt(17, 19)
      junior.contractGames = randInt(30, 60)
      junior.nationality = team.country
      team.players.push(junior)
      promoted.push(junior.name)
    }
  }
  if (promoted.length > 0) team.lineup = defaultLineup(team.players)
  return promoted
}

// IA pós-rodada: renovações, leilões de venda, agentes livres, banco
export function aiPostRound(state: GameState) {
  for (const team of Object.values(state.teams)) {
    // base repõe elenco de qualquer clube muito desfalcado (humano incluído)
    if (team.players.length < 14) {
      const names = promoteJuniors(state, team)
      if (team.isHuman && names.length > 0) {
        state.news.unshift({
          round: state.currentMatchday,
          season: state.season,
          text: `🧒 Base do ${team.name} promoveu: ${names.join(', ')}.`,
        })
      }
    }
    if (team.isHuman) continue

    // amortiza empréstimo se sobrar caixa
    if (team.loan && team.cash > team.loan.amount * 2 + 500000) {
      repay(state, team)
    }

    // plantel cheio e pouco caixa → vende o mais fraco em leilão
    const wages = team.players.reduce((s, p) => s + p.salary, 0)
    if (team.players.length >= 22 && team.cash < 3 * wages * 10) {
      const weakest = team.players
        .filter((p) => !p.auction && p.blockedUntilSeason <= state.seasonNumber && !team.lineup.includes(p.id))
        .sort((a, b) => a.strength - b.strength)[0]
      if (weakest && rand() < 0.5) {
        weakest.auction = { minPrice: Math.round(playerValue(weakest, undefined, state.inflation) * 0.8) }
        state.auctions.push({
          playerId: weakest.id, sellerTeamId: team.id,
          minPrice: weakest.auction.minPrice, createdRound: state.currentMatchday,
        })
      }
    }

    // "ciclo de vendas irrisórias": todo clube tem uma chance por rodada de
    // pôr um reserva em leilão sem lance mínimo — com 80 clubes isso gera
    // negociações IA-vs-IA visíveis nas Notícias quase toda rodada
    if (rand() < 0.08 && team.players.length > 14) {
      const candidates = team.players.filter(
        (p) => !p.auction && !team.lineup.includes(p.id) && p.blockedUntilSeason <= state.seasonNumber,
      )
      const victim = candidates[randInt(0, Math.max(0, candidates.length - 1))]
      if (victim) {
        victim.auction = { minPrice: 0 }
        state.auctions.push({ playerId: victim.id, sellerTeamId: team.id, minPrice: 0, createdRound: state.currentMatchday })
      }
    }

    // contrata agente livre se elenco curto e caixa boa
    const needsPlayers = team.players.length < 15
    const wealthy = team.cash > 1000000
    if ((needsPlayers || (wealthy && rand() < 0.08)) && state.freeAgents.length > 0) {
      const candidates = state.freeAgents
        .filter((p) => canBuy(team, p) === null && playerValue(p, team, state.inflation) * 0.2 < team.cash * 0.3 && p.age < 33)
        .sort((a, b) => b.strength - a.strength)
      const target = candidates[0]
      if (target) {
        const bonus = Math.round(playerValue(target, team, state.inflation) * 0.2)
        team.cash -= bonus
        state.freeAgents = state.freeAgents.filter((p) => p.id !== target.id)
        target.contractGames = 30
        target.salary = salaryDemand(target, state.inflation)
        team.players.push(target)
        team.lineup = defaultLineup(team.players)
      }
    }
  }
}

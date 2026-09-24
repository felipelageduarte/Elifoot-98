import type {
  CalendarEntry, Division, Fixture, GameState, Manager, MatchResult, Player, Standing, Team,
} from './types'
import { DISTRITAL } from './types'
import { simulateMatch } from './match'
import { rand, randInt, random, pick } from './rng'
import { defaultLineup, autoLineup, makePlayer } from './newgame'
import { salaryDemand, playerValue } from './transfers'
import { buildRounds } from './schedule'
import { buildCup, buildCalendar, cupStageCount, advanceCup } from './cup'
import { ledgerAdd, loanInterest } from './finance'
import { drawReferee } from './referees'
import { autoSellForDebt, pendingLots, resolveLot } from './auction'
import { aiPostRound, promoteJuniors } from './ai'
import { recordMatchStats } from './stats'

export function computeStandings(state: GameState, division: Division): Standing[] {
  const map: Record<number, Standing> = {}
  for (const id of division.teamIds) {
    map[id] = { teamId: id, points: 0, played: 0, wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0 }
  }
  for (const round of division.rounds) {
    for (const f of round.fixtures) {
      if (!f.result) continue
      const h = map[f.homeId]
      const a = map[f.awayId]
      if (!h || !a) continue
      h.played++; a.played++
      h.goalsFor += f.result.homeGoals; h.goalsAgainst += f.result.awayGoals
      a.goalsFor += f.result.awayGoals; a.goalsAgainst += f.result.homeGoals
      if (f.result.homeGoals > f.result.awayGoals) { h.wins++; h.points += 3; a.losses++ }
      else if (f.result.homeGoals < f.result.awayGoals) { a.wins++; a.points += 3; h.losses++ }
      else { h.draws++; a.draws++; h.points++; a.points++ }
    }
  }
  return Object.values(map).sort(
    (x, y) => y.points - x.points || (y.goalsFor - y.goalsAgainst) - (x.goalsFor - x.goalsAgainst) || y.goalsFor - x.goalsFor || x.teamId - y.teamId,
  )
}

export function positionOf(standings: Standing[], teamId: number): number {
  return standings.findIndex((s) => s.teamId === teamId) + 1
}

export function managerOf(state: GameState, teamId: number): Manager | undefined {
  return state.managers.find((m) => m.teamId === teamId)
}

export function currentEntry(state: GameState): CalendarEntry | null {
  return state.calendar[state.currentMatchday] ?? null
}

export function entryLabel(state: GameState, entry: CalendarEntry): string {
  if (entry.type === 'league') return `${entry.index + 1}ª Rodada — Campeonato`
  const stage = state.cup.stages[entry.index]
  return `TAÇA — ${stage ? stage.name : '...'}`
}

// Evolução ancorada à média do clube ±5, dirigida pelo resultado
function evolvePostMatch(team: Team, playedIds: number[], won: boolean, drew: boolean) {
  const starters = team.lineup.map((id) => team.players.find((p) => p.id === id)).filter((p): p is Player => !!p)
  const base = starters.length > 0 ? starters.reduce((s, p) => s + p.strength, 0) / starters.length : 20

  for (const p of team.players) {
    if (!playedIds.includes(p.id)) continue
    let aval = 0
    if (won) aval = 1
    else if (drew) aval = rand() < 0.5 ? 1 : 0
    else aval = rand() < 0.5 ? -1 : 0

    if (aval === 1) {
      if (p.pos === 'G' && rand() < 0.5) continue // goleiros 50% mais lentos
      if (p.strength < 50 && p.strength <= base + 5) p.strength++
    } else if (aval === -1) {
      if (p.strength > 1 && p.strength >= base - 5) p.strength--
    }
  }
}

// Moral do elenco, 0-20
function updateMoral(team: Team, won: boolean, drew: boolean, away: boolean) {
  if (won) {
    team.moral += 1 + (away ? 1 : 0)
    team.consecutiveLosses = 0
  } else if (drew) {
    team.consecutiveLosses = 0
  } else {
    team.moral -= 1
    team.consecutiveLosses++
  }
  if (team.cash < 0) team.moral -= 1
  team.moral = Math.max(0, Math.min(20, team.moral))
}

// Pontos de ranking do treinador
function updateRanking(state: GameState, team: Team, won: boolean, drew: boolean, away: boolean) {
  const manager = managerOf(state, team.id)
  if (!manager) return
  if (won) manager.rankingPoints += away ? 3 : 2
  else if (drew) manager.rankingPoints += away ? 2 : 1
}

function payAndCollect(state: GameState, team: Team, result: MatchResult, isHome: boolean, news: string[]) {
  // bilheteria: mandante; campo neutro divide
  if (result.neutral) {
    const half = Math.round(result.gate / 2)
    team.cash += half
    ledgerAdd(state, team, 'bilheteria', half, `Renda em campo neutro (${result.attendance.toLocaleString('pt-BR')} pagantes)`)
  } else if (isHome) {
    team.cash += result.gate
    ledgerAdd(state, team, 'bilheteria', result.gate, `Renda vs ${state.teams[result.awayId]?.name ?? '?'} (${result.attendance.toLocaleString('pt-BR')} pagantes)`)
  }

  const wages = team.players.reduce((s, p) => s + p.salary, 0)
  team.cash -= wages
  ledgerAdd(state, team, 'salarios', -wages, 'Folha salarial do jogo')

  // juros do empréstimo: 5% do capital por jogo
  const interest = loanInterest(team)
  if (interest > 0) {
    team.cash -= interest
    ledgerAdd(state, team, 'juros_emprestimo', -interest, 'Juros do empréstimo (5% do capital)')
  }

  // contratos: decrementa por jogo; ao zerar → pedido de aumento
  for (const p of team.players) {
    if (p.contractGames > 0) p.contractGames--
    if (p.contractGames === 0 && !p.auction && !state.raiseRequests.some((r) => r.playerId === p.id)) {
      const demanded = salaryDemand(p, state.inflation)
      const canSellPlayer =
        team.players.length > 11 &&
        (p.pos !== 'G' || team.players.filter((x) => x.pos === 'G').length > 1)
      state.raiseRequests.push({ playerId: p.id, teamId: team.id, demandedSalary: demanded, mandatory: !canSellPlayer })
      if (team.isHuman) {
        news.push(`💰 ${p.name} (${team.short}) pede aumento para $${demanded.toLocaleString('pt-BR')}/jogo.`)
      }
    }
    if (p.suspendedGames > 0) p.suspendedGames--
    if (p.injuredGames > 0) p.injuredGames--
  }
}

// Pedidos de aumento: IA e times de férias resolvem automaticamente
export function autoResolveRaises(state: GameState, onlyAi = true) {
  const remaining: typeof state.raiseRequests = []
  for (const req of state.raiseRequests) {
    const team = state.teams[req.teamId]
    const player = team?.players.find((p) => p.id === req.playerId)
    if (!team || !player) continue
    const manager = managerOf(state, team.id)
    const isAuto = !team.isHuman || manager?.onVacation || manager?.autoRaises
    if (onlyAi && !isAuto) {
      remaining.push(req)
      continue
    }
    resolveRaise(state, req, team.cash > player.salary * 30 || req.mandatory)
  }
  state.raiseRequests = remaining
}

// Aceitar aumento (contrato +30 jogos) ou recusar → leilão automático
export function resolveRaise(state: GameState, req: { playerId: number; teamId: number; demandedSalary: number; mandatory: boolean }, accept: boolean): string {
  const team = state.teams[req.teamId]
  const player = team?.players.find((p) => p.id === req.playerId)
  if (!team || !player) return 'Jogador não encontrado.'
  state.raiseRequests = state.raiseRequests.filter((r) => r.playerId !== req.playerId)

  if (accept || req.mandatory) {
    player.salary = req.demandedSalary
    player.contractGames = 30
    return `${player.name} aceitou: salário $${req.demandedSalary.toLocaleString('pt-BR')}/jogo por 30 jogos.`
  }
  // recusa → leilão pelo valor de mercado
  player.auction = { minPrice: Math.round(playerValue(player, undefined, state.inflation) * 0.6) }
  state.auctions.push({
    playerId: player.id,
    sellerTeamId: team.id,
    minPrice: player.auction.minPrice,
    createdRound: state.currentMatchday,
  })
  player.contractGames = 5 // segura até vender
  return `${player.name} foi posto à venda em leilão.`
}

export interface RoundReport {
  results: { competition: string; result: MatchResult }[]
  news: string[]
  auctionMessages: string[]
  invites: { managerName: string; teamId: number }[]
  cupWinnerId: number | null
}

export interface PendingHumanMatch {
  competition: string
  homeId: number
  awayId: number
  neutral: boolean
  isCup: boolean
}

export interface RoundStart {
  aiResults: { competition: string; result: MatchResult }[]
  humanMatches: PendingHumanMatch[]
  label: string
}

function fixturesOfEntry(state: GameState, entry: CalendarEntry): { fixtures: Fixture[]; isCup: boolean } {
  if (entry.type === 'league') {
    const all: Fixture[] = []
    for (const division of state.divisions) {
      const round = division.rounds[entry.index]
      if (round) all.push(...round.fixtures)
    }
    return { fixtures: all, isCup: false }
  }
  const stage = state.cup.stages[entry.index]
  return { fixtures: stage ? stage.fixtures : [], isCup: true }
}

function isHumanControlled(state: GameState, team: Team): boolean {
  if (!team.isHuman) return false
  const manager = managerOf(state, team.id)
  return !manager?.onVacation
}

// Fase 1: escala IA, simula jogos sem humanos
export function startRound(state: GameState): RoundStart {
  const entry = currentEntry(state)
  if (!entry) return { aiResults: [], humanMatches: [], label: 'Temporada encerrada' }
  const label = entryLabel(state, entry)
  const { fixtures, isCup } = fixturesOfEntry(state, entry)

  // IA escala (Automático)
  for (const team of Object.values(state.teams)) {
    if (!isHumanControlled(state, team)) {
      team.lineup = autoLineup(team.players).lineup
    }
  }

  const aiResults: RoundStart['aiResults'] = []
  const humanMatches: PendingHumanMatch[] = []

  for (const fixture of fixtures) {
    const home = state.teams[fixture.homeId]
    const away = state.teams[fixture.awayId]
    const neutral = fixture.neutral ?? false
    if (isHumanControlled(state, home) || isHumanControlled(state, away)) {
      humanMatches.push({ competition: label, homeId: home.id, awayId: away.id, neutral, isCup })
    } else {
      const result = simulateMatch(home, away, drawReferee(state.referees), state.inflation, { neutral, isCup })
      fixture.result = result
      aiResults.push({ competition: label, result })
    }
  }
  return { aiResults, humanMatches, label }
}

// Fase 2: pós-jogo completo
export function finishRound(state: GameState, humanResults: { result: MatchResult }[]): RoundReport {
  const entry = currentEntry(state)!
  const label = entryLabel(state, entry)
  const { fixtures, isCup } = fixturesOfEntry(state, entry)
  const report: RoundReport = { results: [], news: [], auctionMessages: [], invites: [], cupWinnerId: null }

  for (const { result } of humanResults) {
    const fixture = fixtures.find((f) => f.homeId === result.homeId && f.awayId === result.awayId)
    if (fixture) fixture.result = result
  }

  for (const fixture of fixtures) {
    const result = fixture.result
    if (!result) continue
    report.results.push({ competition: label, result })
    const home = state.teams[fixture.homeId]
    const away = state.teams[fixture.awayId]

    const playedOf = (team: Team) =>
      [...team.lineup, ...result.events.filter((e) => e.teamId === team.id).map((e) => e.playerId).filter((x): x is number => x !== null)]

    let homeWon = result.homeGoals > result.awayGoals
    let awayWon = result.awayGoals > result.homeGoals
    let drew = result.homeGoals === result.awayGoals
    if (drew && result.shootout) {
      // taça: vencedor nos pênaltis conta como vitória para moral/evolução
      homeWon = result.shootout.homeGoals > result.shootout.awayGoals
      awayWon = !homeWon
      drew = false
    }

    evolvePostMatch(home, playedOf(home), homeWon, drew)
    evolvePostMatch(away, playedOf(away), awayWon, drew)
    updateMoral(home, homeWon, drew, false)
    updateMoral(away, awayWon, drew, true)
    if (!isCup) {
      updateRanking(state, home, homeWon, drew, false)
      updateRanking(state, away, awayWon, drew, true)
    }
    payAndCollect(state, home, result, true, report.news)
    payAndCollect(state, away, result, false, report.news)
    recordMatchStats(state.stats, result)
  }

  // taça: avança fase quando completa
  if (isCup) {
    const stage = state.cup.stages[entry.index]
    if (stage && stage.fixtures.every((f) => f.result)) {
      advanceCup(state.cup)
      if (state.cup.winnerId !== null) {
        report.cupWinnerId = state.cup.winnerId
        const champ = state.teams[state.cup.winnerId]
        const prize = Math.round(6000000 * state.inflation)
        champ.cash += prize
        ledgerAdd(state, champ, 'premiacao', prize, 'Prêmio: VENCEDOR DA TAÇA')
        const manager = managerOf(state, champ.id)
        if (manager) {
          manager.cups++
          manager.history.push({ season: state.season, text: `${manager.cups}ª taça (${champ.name})` })
        }
        champ.seasonHistory?.push(`${state.season}: VENCEDOR DA TAÇA`)
        report.news.unshift(`🏆 ${champ.name} é o VENCEDOR DA TAÇA ${state.season}! Prêmio: $${prize.toLocaleString('pt-BR')}.`)
      }
    }
  }

  state.currentMatchday++

  // dívida: venda automática em leilão
  for (const team of Object.values(state.teams)) {
    const msg = autoSellForDebt(state, team)
    if (msg && team.isHuman) report.news.push(msg)
  }

  // demissões: 5 derrotas seguidas OU dívida > 3× folha por 3 rodadas
  handleFirings(state, report)

  // IA resolve os próprios pedidos de aumento
  autoResolveRaises(state, true)

  // IA pós-rodada: mercado
  aiPostRound(state)

  for (const n of report.news) state.news.unshift({ round: state.currentMatchday, season: state.season, text: n })
  state.news = state.news.slice(0, 200)
  return report
}

function handleFirings(state: GameState, report: RoundReport) {
  for (const team of Object.values(state.teams)) {
    const manager = managerOf(state, team.id)
    if (!manager) continue
    const wages = team.players.reduce((s, p) => s + p.salary, 0)
    const debtTrigger = team.cash < -(3 * wages)
    if (debtTrigger) team.debtRounds = (team.debtRounds ?? 0) + 1
    else team.debtRounds = 0

    const fired = team.consecutiveLosses >= 5 || (team.debtRounds ?? 0) >= 3
    if (!fired) continue

    manager.teamId = null
    manager.history.push({ season: state.season, text: `Despedido do ${team.name}` })
    team.consecutiveLosses = 0
    team.debtRounds = 0

    if (manager.human) {
      team.isHuman = false
      state.humanTeamIds = state.humanTeamIds.filter((id) => id !== team.id)
      report.news.push(`🚨 CHICOTADA PSICOLÓGICA: ${manager.name} foi despedido do ${team.name}!`)
      // novo técnico IA assume
      const newName = `Téc. ${pick(['Silva', 'Souza', 'Pereira', 'Gomes', 'Ramos', 'Nunes'])}`
      team.managerName = newName
      state.managers.push({
        name: newName, human: false, teamId: team.id, rankingPoints: 0, championships: 0, cups: 0,
        history: [], onVacation: false, autoRaises: false, auctionPolicy: 'all',
      })
    } else {
      report.news.push(`🔥 ${manager.name} foi despedido do ${team.name}.`)
      // convite a um humano: melhor ranking desempregado, senão empregado em divisão inferior
      const humans = state.managers
        .filter((m) => m.human)
        .sort((a, b) => b.championships - a.championships || b.cups - a.cups || b.rankingPoints - a.rankingPoints)
      const candidate =
        humans.find((m) => m.teamId === null) ??
        humans.find((m) => {
          const current = m.teamId ? state.teams[m.teamId] : null
          return current && current.division > team.division
        })
      if (candidate) {
        report.invites.push({ managerName: candidate.name, teamId: team.id })
      } else {
        assignAiManager(state, team)
      }
    }
  }
}

function assignAiManager(state: GameState, team: Team) {
  const newName = `Téc. ${pick(['Costa', 'Lima', 'Barros', 'Rocha', 'Teixeira', 'Moraes'])}`
  team.managerName = newName
  team.isHuman = false
  state.managers.push({
    name: newName, human: false, teamId: team.id, rankingPoints: 0, championships: 0, cups: 0,
    history: [], onVacation: false, autoRaises: false, auctionPolicy: 'all',
  })
}

// Aceitar/recusar convite
export function acceptInvite(state: GameState, managerName: string, teamId: number): string {
  const manager = state.managers.find((m) => m.name === managerName && m.human)
  const team = state.teams[teamId]
  if (!manager || !team) return 'Convite inválido.'

  // clube antigo fica com IA
  if (manager.teamId !== null) {
    const old = state.teams[manager.teamId]
    if (old) {
      old.isHuman = false
      state.humanTeamIds = state.humanTeamIds.filter((id) => id !== old.id)
      assignAiManager(state, old)
    }
  }
  // técnico IA anterior do novo clube sai
  const oldManager = managerOf(state, team.id)
  if (oldManager && oldManager !== manager) oldManager.teamId = null

  manager.teamId = team.id
  team.isHuman = true
  team.managerName = manager.name
  if (!state.humanTeamIds.includes(team.id)) state.humanTeamIds.push(team.id)
  manager.history.push({ season: state.season, text: `Contratado pelo ${team.name}` })
  return `${manager.name} é o novo treinador do ${team.name}!`
}

export function declineInvite(state: GameState, teamId: number) {
  const team = state.teams[teamId]
  if (team && !managerOf(state, teamId)) assignAiManager(state, team)
}

// Rodada completa sem interação (testes / simulação em lote)
export function playRound(state: GameState): RoundReport {
  // resolve leilões pendentes (sem ofertas humanas manuais)
  const lots = pendingLots(state)
  const auctionMessages = lots.map((lot) => resolveLot(state, lot, []).message)
  autoResolveRaises(state, false)

  const { humanMatches } = startRound(state)
  const humanResults = humanMatches.map((m) => ({
    result: simulateMatch(state.teams[m.homeId], state.teams[m.awayId], drawReferee(state.referees), state.inflation, {
      neutral: m.neutral,
      isCup: m.isCup,
    }),
  }))
  const report = finishRound(state, humanResults)
  report.auctionMessages = auctionMessages
  return report
}

export function seasonFinished(state: GameState): boolean {
  return state.currentMatchday >= state.calendar.length
}

export interface SeasonSummary {
  champions: { division: string; teamName: string }[]
  cupWinner: string
  promoted: string[]
  relegated: string[]
  topScorers: { name: string; team: string; goals: number }[]
}

const CHAMPION_PRIZE = 20000000
const TOP_SCORER_PRIZE = 3000000

export function endSeason(state: GameState): SeasonSummary {
  const isClassic = state.mode === 'classic1998'
  const promotedCount = isClassic ? 2 : 4
  const summary: SeasonSummary = { champions: [], cupWinner: '', promoted: [], relegated: [], topScorers: [] }
  const moves: { teamId: number; toDivision: number }[] = []
  const champions: Record<number, string> = {}

  for (const division of state.divisions) {
    const standings = computeStandings(state, division)
    const champ = state.teams[standings[0].teamId]
    champions[division.level] = champ.name
    summary.champions.push({ division: division.name, teamName: champ.name })

    // prêmio do campeão (20M na 1ª, escalonado nas inferiores)
    const prize = Math.round(CHAMPION_PRIZE * Math.pow(0.5, division.level - 1) * state.inflation)
    champ.cash += prize
    ledgerAdd(state, champ, 'premiacao', prize, `Prêmio: campeão da ${division.name}`)
    champ.seasonHistory?.push(`${state.season}: Campeão da ${division.name}`)

    const champManager = managerOf(state, champ.id)
    if (champManager) {
      if (division.level === 1) champManager.championships++
      champManager.history.push({
        season: state.season,
        text: division.level === 1 ? `${champManager.championships}ª vitória no campeonato (${champ.name})` : `Campeão da ${division.name} (${champ.name})`,
      })
    }
    // 2º e 3º lugar na história (1ª divisão)
    if (division.level === 1) {
      for (const posIdx of [1, 2]) {
        const m = managerOf(state, standings[posIdx].teamId)
        m?.history.push({ season: state.season, text: `${posIdx + 1}º lugar (${state.teams[standings[posIdx].teamId].name})` })
      }
    }

    if (division.level > 1) {
      for (const s of standings.slice(0, promotedCount)) {
        moves.push({ teamId: s.teamId, toDivision: division.level - 1 })
        summary.promoted.push(`${state.teams[s.teamId].name} → ${state.divisions[division.level - 2].name}`)
        managerOf(state, s.teamId)?.history.push({ season: state.season, text: `Promovido para a ${state.divisions[division.level - 2].name}` })
      }
    }
    const isLast = division.level === state.divisions.length
    if (!isLast) {
      for (const s of standings.slice(-promotedCount)) {
        moves.push({ teamId: s.teamId, toDivision: division.level + 1 })
        summary.relegated.push(`${state.teams[s.teamId].name} → ${state.divisions[division.level].name}`)
        managerOf(state, s.teamId)?.history.push({ season: state.season, text: `Despromovido para a ${state.divisions[division.level].name}` })
      }
    } else if (isClassic) {
      // 4ª ↔ Distrital: 2 piores descem, 2 melhores distritais sobem
      for (const s of standings.slice(-2)) {
        moves.push({ teamId: s.teamId, toDivision: DISTRITAL })
        summary.relegated.push(`${state.teams[s.teamId].name} → Distrital`)
        managerOf(state, s.teamId)?.history.push({ season: state.season, text: 'Despromovido para a Distrital' })
      }
      const bestDistrital = state.distritalTeamIds
        .map((id) => state.teams[id])
        .sort((a, b) => avgStrength(b) - avgStrength(a))
        .slice(0, 2)
      for (const t of bestDistrital) {
        moves.push({ teamId: t.id, toDivision: state.divisions.length })
        summary.promoted.push(`${t.name} → ${division.name}`)
        managerOf(state, t.id)?.history.push({ season: state.season, text: `Promovido para a ${division.name}` })
      }
    }
  }

  summary.cupWinner = state.cup.winnerId !== null ? state.teams[state.cup.winnerId].name : '—'

  // artilheiros (3 melhores; prêmio de 3M ao clube de cada empatado em 1º)
  const scorers: { name: string; team: string; teamId: number; goals: number }[] = []
  for (const team of Object.values(state.teams)) {
    for (const p of team.players) {
      scorers.push({ name: p.name, team: team.name, teamId: team.id, goals: p.goals })
    }
  }
  scorers.sort((a, b) => b.goals - a.goals)
  summary.topScorers = scorers.slice(0, 3)
  const maxGoals = scorers[0]?.goals ?? 0
  for (const s of scorers.filter((x) => x.goals === maxGoals && maxGoals > 0)) {
    const t = state.teams[s.teamId]
    const prize = Math.round(TOP_SCORER_PRIZE * state.inflation)
    t.cash += prize
    ledgerAdd(state, t, 'premiacao', prize, `Prêmio: melhor marcador (${s.name}, ${s.goals} gols)`)
    managerOf(state, t.id)?.history.push({ season: state.season, text: `Melhor marcador (${s.name}, ${s.goals} golos)` })
  }

  state.history.push({
    season: state.season,
    champions,
    cupWinner: summary.cupWinner,
    topScorer: summary.topScorers[0] ? `${summary.topScorers[0].name} (${summary.topScorers[0].team}) — ${summary.topScorers[0].goals} gols` : '',
  })

  // aplica movimentações de divisão
  for (const move of moves) state.teams[move.teamId].division = move.toDivision
  for (const division of state.divisions) {
    division.teamIds = Object.values(state.teams).filter((t) => t.division === division.level).map((t) => t.id)
  }
  state.distritalTeamIds = Object.values(state.teams).filter((t) => t.division === DISTRITAL).map((t) => t.id)

  // virada de época
  state.inflation = Math.round(state.inflation * 1.05 * 1000) / 1000
  for (const team of Object.values(state.teams)) {
    for (const p of team.players.slice()) {
      p.age++
      p.goals = 0
      p.yellowCards = 0
      p.suspendedGames = 0
      p.injuredGames = 0
      p.noAuctionUntilRound = -1
      if (p.age >= 35 && rand() < 0.5) {
        team.players = team.players.filter((x) => x.id !== p.id)
        continue
      }
      if (p.age >= 31 && rand() < 0.4 && p.strength > 5) p.strength -= randInt(1, 3)
      if (p.age <= 23 && rand() < 0.5 && p.strength < 50) p.strength += randInt(1, 2)
      // inflação nos salários
      p.salary = Math.round(p.salary * 1.05)
    }
    if (team.players.length < 14) promoteJuniors(state, team)
    team.lineup = defaultLineup(team.players)
    team.moral = 11
    team.consecutiveLosses = 0
    if (team.ledger) team.ledger = team.ledger.filter((e) => e.season >= state.season)
  }

  state.freeAgents = state.freeAgents.filter(() => rand() < 0.5)
  state.auctions = []
  state.raiseRequests = []

  // novo calendário
  state.season++
  state.seasonNumber++
  state.currentMatchday = 0
  for (const division of state.divisions) {
    division.rounds = buildRounds(division.teamIds)
  }
  const allIds = Object.values(state.teams).map((t) => t.id)
  state.cup = buildCup(allIds)
  state.calendar = buildCalendar(state.divisions[0].rounds.length, cupStageCount(allIds.length))

  return summary
}

function avgStrength(team: Team): number {
  if (team.players.length === 0) return 0
  return team.players.reduce((s, p) => s + p.strength, 0) / team.players.length
}

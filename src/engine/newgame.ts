import type { Behavior, GameMode, GameState, Manager, Player, Position, Team } from './types'
import { DIVISION_NAMES, CLASSIC_DIVISION_NAMES, DISTRITAL, BEHAVIOR_PRICE_FACTORS } from './types'
import { ALL_DIVISIONS, DIVISION_LEVEL } from '../data/teams'
import { playerName } from './names'
import { randInt, rand, pick, shuffle, random } from './rng'
import { buildRounds } from './schedule'
import { buildCup, buildCalendar, cupStageCount } from './cup'
import { REFEREES } from './referees'
import { makeEmptyStats } from './stats'

// Formato do dataset opcional do modo Clássico 1998, carregado em tempo de
// execução via fetch('/data/classic1998.json') — ver src/ui/MainMenu.tsx.
// O arquivo não faz parte do repositório público; sem ele, o modo Clássico
// simplesmente não aparece no menu.
export interface ClassicSeed {
  nome_abreviado: string
  nome_completo: string
  pais: string
  nivel_inicial: number
  cor_fundo: string
  cor_texto: string
  treinador: string
  jogadores: { nome: string; posicao: string; pais: string }[]
}

let nextPlayerId = 1

// Salário pretendido = (força×15 + força²) × fator_comportamento × inflação
export function baseSalary(strength: number, behavior: Behavior, inflation = 1): number {
  return Math.max(10, Math.round((strength * 15 + strength * strength) * BEHAVIOR_PRICE_FACTORS[behavior] * inflation))
}

// Força a partir do nível do clube (1-20) — mesma fórmula usada no
// modo Clássico 1998, agora também alimenta o Brasileirão 2026, para os
// pesos ficarem fiéis ao original em todas as divisões (ex.: Série D com
// jogadores fracos de verdade, força 1-12).
export function strengthFromLevel(level: number, pos: Position): number {
  const base = 2 + Math.round(level * 2.2)
  let strength = Math.max(1, Math.min(50, base + randInt(-6, 6)))
  if (pos === 'G') strength = Math.max(1, strength - 2)
  return strength
}

// Sorteio de comportamento: defesas mais violentos
function drawBehavior(pos: Position): Behavior {
  const weights =
    pos === 'D'
      ? [12, 18, 22, 25, 10, 13] // Sarrafeiro..Fair play
      : [5, 8, 12, 20, 25, 30]
  const total = weights.reduce((a, b) => a + b, 0)
  let r = random(total)
  for (let i = 0; i < 6; i++) {
    r -= weights[i]
    if (r < 0) return i as Behavior
  }
  return 3
}

export function makePlayer(
  pos: Position,
  strength: number,
  opts: { nat?: string; name?: string; inflation?: number; age?: number } = {},
): Player {
  const behavior = drawBehavior(pos)
  const star = (pos === 'M' || pos === 'A') && rand() < 0.3
  return {
    id: nextPlayerId++,
    name: opts.name ?? playerName(),
    star: opts.name ? false : star,
    pos,
    strength: Math.max(1, Math.min(50, strength)),
    age: opts.age ?? randInt(17, 34),
    nationality: opts.nat ?? 'BRA',
    contractGames: randInt(5, 25),
    salary: baseSalary(strength, behavior, opts.inflation ?? 1),
    behavior,
    yellowCards: 0,
    suspendedGames: 0,
    injuredGames: 0,
    goals: 0,
    history: { games: 0, goals: 0, reds: 0, injuries: 0 },
    forSale: false,
    auction: null,
    blockedUntilSeason: 0,
    noAuctionUntilRound: -1,
  }
}

// Elenco padrão do modo 2026: 2 G, 6 D, 6 M, 4 A = 18
const SQUAD_TEMPLATE: [Position, number][] = [
  ['G', 2],
  ['D', 6],
  ['M', 6],
  ['A', 4],
]

const FOREIGN_NATS = ['ARG', 'URU', 'PAR', 'COL', 'CHL', 'EQU', 'VNZ', 'PER', 'BOL', 'MEX']

export function generateSquad(
  division: number,
  stars: { name: string; pos: Position; strength: number; nat: string }[] = [],
): Player[] {
  const level = DIVISION_LEVEL[Math.min(division, 4) - 1]
  const players: Player[] = []
  for (const s of stars) {
    const p = makePlayer(s.pos, s.strength, { nat: s.nat, name: s.name })
    p.star = (s.pos === 'M' || s.pos === 'A') && s.strength >= 42
    players.push(p)
  }
  for (const [pos, count] of SQUAD_TEMPLATE) {
    const existing = players.filter((p) => p.pos === pos).length
    for (let i = existing; i < count; i++) {
      const nat = rand() < 0.08 ? pick(FOREIGN_NATS) : 'BRA'
      players.push(makePlayer(pos, strengthFromLevel(level, pos), { nat }))
    }
  }
  return players
}

// -------- Formações: as 12 originais + extensões --------
export const FORMATIONS: [number, number, number][] = [
  [3, 3, 4], [3, 4, 3], [4, 2, 4], [4, 3, 3], [4, 4, 2], [4, 5, 1],
  [5, 2, 3], [5, 3, 2], [5, 4, 1], [5, 5, 0], [6, 3, 1], [6, 4, 0],
]

export function pickLineup(players: Player[], nD: number, nM: number, nA: number): number[] {
  const avail = players.filter((p) => p.suspendedGames === 0 && p.injuredGames === 0)
  const byPos = (pos: Position) => avail.filter((p) => p.pos === pos).sort((a, b) => b.strength - a.strength)

  const lineup: number[] = []
  const gk = byPos('G')[0]
  if (gk) lineup.push(gk.id)
  const take = (pos: Position, n: number) => {
    const list = byPos(pos).filter((p) => !lineup.includes(p.id))
    for (let i = 0; i < Math.min(n, list.length); i++) lineup.push(list[i].id)
  }
  take('D', nD)
  take('M', nM)
  take('A', nA)
  if (lineup.length < 11) {
    for (const p of avail.sort((a, b) => b.strength - a.strength)) {
      if (lineup.length >= 11) break
      if (!lineup.includes(p.id)) lineup.push(p.id)
    }
  }
  return lineup.slice(0, 11)
}

// "Melhores": melhores jogadores na formação dada.
// "Automático": testa as 12 formações e escolhe a de maior Σ força.
export function autoLineup(players: Player[]): { lineup: number[]; formation: [number, number, number] } {
  let best: { lineup: number[]; formation: [number, number, number]; total: number } | null = null
  for (const f of FORMATIONS) {
    const lineup = pickLineup(players, f[0], f[1], f[2])
    const total = lineup.reduce((s, id) => s + (players.find((p) => p.id === id)?.strength ?? 0), 0)
    if (!best || total > best.total) best = { lineup, formation: f, total }
  }
  return { lineup: best!.lineup, formation: best!.formation }
}

export function defaultLineup(players: Player[]): number[] {
  return pickLineup(players, 4, 4, 2)
}

// ---------------- Criação de jogo ----------------

export interface HumanSetup {
  managerName: string
  teamName: string | null // null = sortear um clube na última divisão
}

function makeManager(name: string, human: boolean, teamId: number | null): Manager {
  return {
    name,
    human,
    teamId,
    rankingPoints: 0,
    championships: 0,
    cups: 0,
    history: [],
    onVacation: false,
    autoRaises: false,
    auctionPolicy: 'all',
  }
}

function finishState(
  mode: GameMode,
  teams: Record<number, Team>,
  divisions: GameState['divisions'],
  distritalTeamIds: number[],
  managers: Manager[],
  season: number,
): GameState {
  const allIds = Object.values(teams).map((t) => t.id)
  const cup = buildCup(allIds)
  const leagueRounds = divisions[0].rounds.length
  const calendar = buildCalendar(leagueRounds, cupStageCount(allIds.length))

  // agentes livres iniciais (extensão nossa)
  const freeAgents: Player[] = []
  const positions: Position[] = ['G', 'D', 'D', 'M', 'M', 'A']
  for (let d = 1; d <= 4; d++) {
    const level = DIVISION_LEVEL[d - 1]
    for (let i = 0; i < 10; i++) {
      const pos = pick(positions)
      freeAgents.push(makePlayer(pos, strengthFromLevel(level, pos)))
    }
  }

  return {
    version: 2,
    mode,
    season,
    seasonNumber: 1,
    inflation: 1,
    calendar,
    currentMatchday: 0,
    teams,
    divisions,
    distritalTeamIds,
    cup,
    managers,
    referees: REFEREES,
    auctions: [],
    raiseRequests: [],
    transferLog: [],
    observed: {},
    news: [],
    humanTeamIds: Object.values(teams).filter((t) => t.isHuman).map((t) => t.id),
    nextPlayerId,
    freeAgents,
    history: [],
    stats: makeEmptyStats(season, 1),
  }
}

export function createNewGame(humans: HumanSetup[], season = 2026): GameState {
  nextPlayerId = 1
  const teams: Record<number, Team> = {}
  const divisions = []
  let teamId = 1

  for (let d = 0; d < ALL_DIVISIONS.length; d++) {
    const teamIds: number[] = []
    for (const seedClub of ALL_DIVISIONS[d]) {
      const players = generateSquad(d + 1, seedClub.stars ?? [])
      const team: Team = {
        id: teamId,
        name: seedClub.name,
        short: seedClub.short,
        colors: seedClub.colors,
        country: 'BRA',
        division: d + 1,
        players,
        cash: [2500000, 900000, 350000, 120000][d],
        stadiumCapacity: seedClub.capacity,
        ticketPrice: [40, 25, 15, 10][d],
        isHuman: false,
        managerName: null,
        lineup: defaultLineup(players),
        loan: null,
        fanCount: seedClub.fans * 1000,
        moral: 11,
        consecutiveLosses: 0,
        ledger: [],
        seasonHistory: [],
      }
      teams[teamId] = team
      teamIds.push(teamId)
      teamId++
    }
    divisions.push({ level: d + 1, name: DIVISION_NAMES[d], teamIds, rounds: buildRounds(teamIds) })
  }

  const managers = assignHumans(teams, humans, 4)
  addAiManagers(teams, managers)
  return finishState('br2026', teams, divisions, [], managers, season)
}

// Modo Clássico 1998: recebe o dataset já carregado pela UI (ver ClassicSeed acima)
export function createClassicGame(classicSeeds: ClassicSeed[], humans: HumanSetup[], season = 1998): GameState {
  nextPlayerId = 1
  const teams: Record<number, Team> = {}
  let teamId = 1

  const seeds = shuffle(classicSeeds).sort((a, b) => b.nivel_inicial - a.nivel_inicial)

  for (const seed of seeds) {
    const L = seed.nivel_inicial
    const players: Player[] = seed.jogadores.map((j) => {
      const pos = j.posicao as Position
      return makePlayer(pos, strengthFromLevel(L, pos), { nat: j.pais, name: j.nome, age: randInt(18, 33) })
    })
    // asterisco: 30% dos M/A (não vem no ficheiro)
    for (const p of players) {
      p.star = (p.pos === 'M' || p.pos === 'A') && rand() < 0.3
    }

    const team: Team = {
      id: teamId,
      name: seed.nome_abreviado,
      short: seed.nome_abreviado.slice(0, 3).toUpperCase(),
      colors: [seed.cor_fundo, seed.cor_texto],
      country: seed.pais,
      division: DISTRITAL,
      players,
      cash: 50000 * L,
      stadiumCapacity: 5000 * (1 + Math.floor(L / 4)),
      ticketPrice: Math.max(3, Math.round(5 + (2 + L * 2.2) * 0.5)),
      isHuman: false,
      managerName: seed.treinador,
      lineup: defaultLineup(players),
      loan: null,
      fanCount: L * 20000,
      moral: 11,
      consecutiveLosses: 0,
      ledger: [],
      seasonHistory: [],
    }
    teams[teamId] = team
    teamId++
  }

  // 8 melhores → 1ª, ..., 25-32 → 4ª, resto Distrital
  const ordered = Object.values(teams)
  const divisions = []
  for (let d = 0; d < 4; d++) {
    const slice = ordered.slice(d * 8, d * 8 + 8)
    for (const t of slice) t.division = d + 1
    divisions.push({
      level: d + 1,
      name: CLASSIC_DIVISION_NAMES[d],
      teamIds: slice.map((t) => t.id),
      rounds: buildRounds(slice.map((t) => t.id)),
    })
  }
  const distritalTeamIds = ordered.slice(32).map((t) => t.id)

  const managers = assignHumans(teams, humans, 4)
  addAiManagers(teams, managers)
  return finishState('classic1998', teams, divisions, distritalTeamIds, managers, season)
}

function assignHumans(teams: Record<number, Team>, humans: HumanSetup[], lastDivision: number): Manager[] {
  const managers: Manager[] = []
  for (const h of humans) {
    let team: Team | undefined
    if (h.teamName) {
      team = Object.values(teams).find((t) => t.name === h.teamName && !t.isHuman)
    }
    if (!team) {
      // sorteio na última divisão
      const pool = Object.values(teams).filter((t) => t.division === lastDivision && !t.isHuman)
      team = pool[random(pool.length)]
    }
    if (!team) continue
    team.isHuman = true
    team.managerName = h.managerName
    const m = makeManager(h.managerName, true, team.id)
    m.history.push({ season: 0, text: `Ingresso no ${team.name}` })
    managers.push(m)
  }
  return managers
}

function addAiManagers(teams: Record<number, Team>, managers: Manager[]) {
  for (const t of Object.values(teams)) {
    if (t.isHuman) continue
    const name = t.managerName ?? `Téc. ${playerName()}`
    t.managerName = name
    managers.push(makeManager(name, false, t.id))
  }
}

export function setNextPlayerId(id: number) {
  nextPlayerId = id
}

export function getNextPlayerId(): number {
  return nextPlayerId
}

export function makeFreePlayer(pos: Position, strength: number): Player {
  return makePlayer(pos, strength)
}

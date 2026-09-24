// Tipos centrais do jogo: jogadores, clubes, técnicos e estado da partida.

export type Position = 'G' | 'D' | 'M' | 'A'

// Comportamento em 6 níveis, do pior ao melhor (original)
export type Behavior = 0 | 1 | 2 | 3 | 4 | 5

export const BEHAVIOR_LABELS = [
  'Sarrafeiro',
  'Caceteiro',
  'Caneleiro',
  'Cavalheiro',
  'Cordeirinho',
  'Fair play',
] as const

// Pesos da roleta de faltas/cartões: do pior ao melhor
export const BEHAVIOR_CARD_WEIGHTS = [10, 7, 4, 2, 1, 0] as const

// Fator de preço por comportamento
export const BEHAVIOR_PRICE_FACTORS = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2] as const

export interface PlayerHistory {
  games: number
  goals: number
  reds: number
  injuries: number
}

export interface Player {
  id: number
  name: string
  star: boolean // craque `*`: +25% finalização/pênalti/preço
  pos: Position
  strength: number // força nominal 1..50
  age: number
  nationality: string
  contractGames: number // contador regressivo de jogos
  salary: number // por jogo
  behavior: Behavior // só influencia cartões (roleta) e preço
  yellowCards: number // acumulados na temporada (modernização nossa)
  suspendedGames: number
  injuredGames: number
  goals: number // gols na temporada
  history: PlayerHistory // historial de carreira (RN §3.3)
  // mercado
  forSale: boolean // listado para venda direta (extensão nossa)
  auction: { minPrice: number } | null // em leilão — resolve na próxima rodada
  blockedUntilSeason: number // comprado/renovado: só vende a partir desta temporada
  noAuctionUntilRound: number // leilão sem ofertas: só pode reofertar depois desta rodada
}

export interface TeamInfo {
  id: number
  name: string
  short: string
  colors: [string, string]
  country: string
}

export interface Team extends TeamInfo {
  division: number // 1..4; 99 = Distrital (só taça, modo clássico)
  players: Player[]
  cash: number
  stadiumCapacity: number
  ticketPrice: number
  isHuman: boolean
  managerName: string | null
  lineup: number[]
  loan: { amount: number; roundsLeft: number } | null
  fanCount: number
  moral: number // 0..20
  consecutiveLosses: number // para demissão
  debtRounds?: number
  ledger?: LedgerEntry[]
  seasonHistory?: string[] // historial do clube
}

export const DISTRITAL = 99

export interface Manager {
  name: string
  human: boolean
  teamId: number | null // null = desempregado
  rankingPoints: number // V fora 3, V casa 2, E fora 2, E casa 1
  championships: number
  cups: number
  history: { season: number; text: string }[]
  onVacation: boolean // férias: IA assume
  autoRaises: boolean // perfil: gestão automática de salários
  auctionPolicy: 'all' | 'strong' | 'none' // perfil compra em leilão
}

export interface MatchEvent {
  minute: number
  type:
    | 'goal'
    | 'save'
    | 'post'
    | 'bar'
    | 'wide' // Ao lado
    | 'over' // Por cima
    | 'yellow'
    | 'red'
    | 'injury'
    | 'sub'
    | 'pen_goal'
    | 'pen_miss'
    | 'start'
    | 'half'
    | 'end'
  teamId: number | null
  playerId: number | null
  text: string
}

export interface PenaltyShootout {
  homeGoals: number
  awayGoals: number
  sequence: { teamId: number; scored: boolean; taker: string }[]
}

export interface MatchResult {
  homeId: number
  awayId: number
  homeGoals: number
  awayGoals: number
  events: MatchEvent[]
  attendance: number
  gate: number
  referee: string
  neutral: boolean
  shootout: PenaltyShootout | null // taça empatada
  // contadores para o painel de estatísticas (Histórico → Estatísticas)
  yellowCards: number
  redCards: number
  penaltiesAwarded: number
  penaltiesScored: number
  injuries: number
}

export interface Fixture {
  homeId: number
  awayId: number
  result: MatchResult | null
  neutral?: boolean
}

export interface Round {
  fixtures: Fixture[]
}

export interface Standing {
  teamId: number
  points: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
}

export interface Division {
  level: number
  name: string
  teamIds: number[]
  rounds: Round[]
}

// -------- Taça --------
export interface CupStage {
  name: string // "32 avos de final", "Oitavos de final", ..., "FINAL"
  fixtures: Fixture[]
  byeTeamIds: number[] // isentos na pré-eliminatória
}

export interface Cup {
  stages: CupStage[]
  eliminated: number[] // times fora
  winnerId: number | null
}

// Calendário da temporada: intercala liga e taça
export interface CalendarEntry {
  type: 'league' | 'cup'
  index: number // índice da rodada da liga ou do estágio da taça
}

// -------- Leilão --------
export interface Auction {
  playerId: number
  sellerTeamId: number
  minPrice: number
  createdRound: number
}

// Pedido de aumento pendente
export interface RaiseRequest {
  playerId: number
  teamId: number
  demandedSalary: number
  mandatory: boolean // não pode ser vendido → aumento obrigatório
}

export interface NewsItem {
  round: number
  season: number
  text: string
}

export type LedgerCategory =
  | 'bilheteria'
  | 'premiacao'
  | 'venda'
  | 'compra'
  | 'salarios'
  | 'luvas'
  | 'juros_emprestimo'
  | 'emprestimo'
  | 'quitacao'
  | 'rescisao'
  | 'estadio'

export interface LedgerEntry {
  season: number
  round: number
  cat: LedgerCategory
  amount: number
  desc: string
}

export interface TransferRecord {
  season: number
  round: number
  playerName: string
  fromTeam: string
  toTeam: string
  amount: number
}

export interface ObservedPlayer {
  playerId: number
  note: string
}

export type GameMode = 'br2026' | 'classic1998'

// Estatísticas acumuladas de partidas realmente jogadas (Histórico →
// Estatísticas) — permite verificar na prática o efeito da Calibração
// do motor. Jogos em campo neutro (final da Taça) não entram na conta.
export interface MatchStats {
  since: { season: number; round: number }
  games: number
  homeGoals: number
  awayGoals: number
  homeWins: number
  draws: number
  awayWins: number
  goallessGames: number
  yellowCards: number
  redCards: number
  penaltiesAwarded: number
  penaltiesScored: number
  injuries: number
}

export interface GameState {
  version: number
  mode: GameMode
  season: number
  seasonNumber: number // época 1, 2, 3... (para inflação e prêmios)
  inflation: number // fator multiplicativo
  calendar: CalendarEntry[]
  currentMatchday: number // índice no calendário
  teams: Record<number, Team>
  divisions: Division[]
  distritalTeamIds: number[] // times fora das divisões (modo clássico)
  cup: Cup
  managers: Manager[]
  referees: string[]
  auctions: Auction[]
  raiseRequests: RaiseRequest[] // pendentes para a rodada corrente
  transferLog: TransferRecord[]
  observed: Record<string, ObservedPlayer[]> // por nome de técnico humano (máx 15)
  news: NewsItem[]
  humanTeamIds: number[]
  nextPlayerId: number
  freeAgents: Player[] // extensão nossa (não existia no original)
  history: { season: number; champions: Record<number, string>; cupWinner: string; topScorer: string }[]
  stats: MatchStats
}

export const DIVISION_NAMES = ['Série A', 'Série B', 'Série C', 'Série D']
export const CLASSIC_DIVISION_NAMES = ['1ª Divisão', '2ª Divisão', '3ª Divisão', '4ª Divisão']

export const POSITION_LABEL: Record<Position, string> = {
  G: 'Goleiro',
  D: 'Defesa',
  M: 'Meio-campo',
  A: 'Atacante',
}

export function playerDisplayName(p: Player): string {
  return p.star ? `${p.name}*` : p.name
}

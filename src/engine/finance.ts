import type { GameState, LedgerCategory, LedgerEntry, Team } from './types'

// Empréstimo bancário: parcelas de 100 mil; juros de 5% do capital
// em dívida POR JOGO; limite pela "confiança do banco".
export const LOAN_STEP = 100000
export const LOAN_INTEREST_PER_GAME = 0.05

export function ledgerAdd(state: GameState, team: Team, cat: LedgerCategory, amount: number, desc: string) {
  if (!team.isHuman) return
  if (!team.ledger) team.ledger = []
  team.ledger.push({ season: state.season, round: state.currentMatchday + 1, cat, amount, desc })
  if (team.ledger.length > 1200) team.ledger = team.ledger.slice(-1200)
}

// Limite de crédito, conforme a "confiança do banco" no clube
export function maxLoan(state: GameState, team: Team): number {
  const lastGate = (team.ledger ?? [])
    .slice()
    .reverse()
    .find((e) => e.cat === 'bilheteria')
  const base = 500000 + 3 * (lastGate?.amount ?? team.fanCount * 0.2)
  const trust = team.cash >= 0 ? 1 : 0.5
  return Math.max(0, Math.round((base * trust * state.inflation) / LOAN_STEP) * LOAN_STEP)
}

export function borrow(state: GameState, team: Team): string {
  const current = team.loan?.amount ?? 0
  if (current + LOAN_STEP > maxLoan(state, team)) {
    return 'O banco não confia em você para emprestar mais (aumente a receita ou saia do vermelho).'
  }
  team.loan = { amount: current + LOAN_STEP, roundsLeft: 0 }
  team.cash += LOAN_STEP
  ledgerAdd(state, team, 'emprestimo', LOAN_STEP, 'Empréstimo bancário (+100 mil)')
  return `Empréstimo aumentado. Capital em dívida: $${team.loan.amount.toLocaleString('pt-BR')}.`
}

export function repay(state: GameState, team: Team): string {
  if (!team.loan || team.loan.amount <= 0) return 'Nenhum empréstimo ativo.'
  if (team.cash < LOAN_STEP) return 'Caixa insuficiente para pagar 100 mil.'
  team.loan.amount -= LOAN_STEP
  team.cash -= LOAN_STEP
  ledgerAdd(state, team, 'quitacao', -LOAN_STEP, 'Amortização do empréstimo (−100 mil)')
  if (team.loan.amount <= 0) {
    team.loan = null
    return 'Empréstimo quitado!'
  }
  return `Amortizado. Capital em dívida: $${team.loan.amount.toLocaleString('pt-BR')}.`
}

export function loanInterest(team: Team): number {
  return team.loan ? Math.round(team.loan.amount * LOAN_INTEREST_PER_GAME) : 0
}

export const STADIUM_STEP = 5000

// Preço da bancada nova, escalado pela inflação
export function stadiumExpansionCost(state: GameState): number {
  return Math.round((500000 * state.inflation) / 1000) * 1000
}

export function expandStadium(state: GameState, team: Team): string {
  const cost = stadiumExpansionCost(state)
  if (cost > team.cash) return 'Caixa insuficiente para a obra.'
  team.cash -= cost
  team.stadiumCapacity += STADIUM_STEP
  ledgerAdd(state, team, 'estadio', -cost, `Ampliação do estádio (+${STADIUM_STEP.toLocaleString('pt-BR')} lugares)`)
  return `Estádio ampliado em ${STADIUM_STEP.toLocaleString('pt-BR')} lugares. As novas bancadas já valem para o próximo jogo em casa.`
}

export function weeklyWages(team: Team): number {
  return team.players.reduce((s, p) => s + p.salary, 0)
}

// ---------------- DRE / orçamento ----------------

export const LEDGER_LABELS: Record<LedgerCategory, string> = {
  bilheteria: 'Bilheteria',
  premiacao: 'Premiação',
  venda: 'Venda de jogadores',
  compra: 'Compra de jogadores',
  salarios: 'Salários',
  luvas: 'Luvas e renovações',
  juros_emprestimo: 'Juros do empréstimo',
  emprestimo: 'Empréstimo recebido',
  quitacao: 'Amortização de empréstimo',
  rescisao: 'Rescisões contratuais',
  estadio: 'Obras no estádio',
}

export interface DreLine {
  cat: LedgerCategory
  label: string
  total: number
}

export interface Dre {
  revenues: DreLine[]
  expenses: DreLine[]
  financing: DreLine[]
  totalRevenue: number
  totalExpense: number
  totalFinancing: number
  result: number
}

const FINANCING_CATS: LedgerCategory[] = ['emprestimo', 'quitacao', 'juros_emprestimo']

export function computeDre(entries: LedgerEntry[]): Dre {
  const byCat = new Map<LedgerCategory, number>()
  for (const e of entries) byCat.set(e.cat, (byCat.get(e.cat) ?? 0) + e.amount)
  const revenues: DreLine[] = []
  const expenses: DreLine[] = []
  const financing: DreLine[] = []
  for (const [cat, total] of byCat) {
    const line = { cat, label: LEDGER_LABELS[cat], total }
    if (FINANCING_CATS.includes(cat)) financing.push(line)
    else if (total >= 0) revenues.push(line)
    else expenses.push(line)
  }
  revenues.sort((a, b) => b.total - a.total)
  expenses.sort((a, b) => a.total - b.total)
  const totalRevenue = revenues.reduce((s, l) => s + l.total, 0)
  const totalExpense = expenses.reduce((s, l) => s + l.total, 0)
  const totalFinancing = financing.reduce((s, l) => s + l.total, 0)
  return { revenues, expenses, financing, totalRevenue, totalExpense, totalFinancing, result: totalRevenue + totalExpense }
}

export interface BudgetForecast {
  roundsLeft: number
  homeGamesLeft: number
  projectedWages: number
  projectedGate: number
  projectedLoanPayments: number
  projectedBalance: number
  avgGate: number
}

export function computeBudget(state: GameState, team: Team): BudgetForecast {
  const division = state.divisions.find((d) => d.level === team.division)
  const entriesLeft = state.calendar.length - state.currentMatchday
  let homeGamesLeft = 0
  if (division) {
    for (let i = state.currentMatchday; i < state.calendar.length; i++) {
      const entry = state.calendar[i]
      if (entry.type !== 'league') continue
      const round = division.rounds[entry.index]
      if (round?.fixtures.some((f) => f.homeId === team.id)) homeGamesLeft++
    }
  }
  const gates = (team.ledger ?? []).filter((e) => e.season === state.season && e.cat === 'bilheteria')
  const avgGate = gates.length > 0
    ? Math.round(gates.reduce((s, e) => s + e.amount, 0) / gates.length)
    : Math.round(team.stadiumCapacity * 0.3 * team.ticketPrice)
  const projectedWages = -weeklyWages(team) * entriesLeft
  const projectedGate = avgGate * homeGamesLeft
  const projectedLoanPayments = -loanInterest(team) * entriesLeft
  return {
    roundsLeft: entriesLeft,
    homeGamesLeft,
    projectedWages,
    projectedGate,
    projectedLoanPayments,
    projectedBalance: team.cash + projectedWages + projectedGate + projectedLoanPayments,
    avgGate,
  }
}

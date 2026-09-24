import type { GameState, Player, Team } from './types'
import { BEHAVIOR_PRICE_FACTORS } from './types'
import { defaultLineup, baseSalary } from './newgame'
import { ledgerAdd } from './finance'
import { isForeign, foreignCount, MAX_FOREIGNERS, MAX_SQUAD, MIN_GK, MIN_FIELD } from './nationality'
import { rand } from './rng'

// Preço-base = força² × 4000 × fatores (comportamento, estrangeiro,
// craque, inflação) — modulado também pela idade (extensão nossa)
export function playerValue(p: Player, forClub?: Team, inflation = 1): number {
  let base = p.strength * p.strength * 4000
  base *= BEHAVIOR_PRICE_FACTORS[p.behavior]
  if (forClub && isForeign(p.nationality, forClub.country)) base *= 0.75
  if (p.star) base *= 1.25
  let ageFactor = 1.0
  if (p.age <= 21) ageFactor = 1.3
  else if (p.age >= 33) ageFactor = 0.5
  else if (p.age >= 30) ageFactor = 0.75
  return Math.max(1000, Math.round((base * ageFactor * inflation) / 1000) * 1000)
}

export function salaryDemand(p: Player, inflation = 1): number {
  return baseSalary(p.strength, p.behavior, inflation)
}

export interface OfferOutcome {
  accepted: boolean
  price: number
  message: string
}

// Validações de plantel do COMPRADOR
export function canBuy(buyer: Team, player: Player): string | null {
  if (buyer.players.length >= MAX_SQUAD) return `O plantel já tem ${MAX_SQUAD} jogadores (máximo).`
  if (isForeign(player.nationality, buyer.country)) {
    if (foreignCount(buyer.players, buyer.country) >= MAX_FOREIGNERS) {
      return 'Tem demasiados jogadores estrangeiros (máximo 5, exceto por acordos de livre circulação).'
    }
  }
  return null
}

// Validações de saída do VENDEDOR
export function canSell(seller: Team, player: Player): string | null {
  const rest = seller.players.filter((p) => p.id !== player.id)
  if (rest.length < 11) return 'Não pode vender mais jogadores (mínimo 11).'
  if (rest.filter((p) => p.pos === 'G').length < MIN_GK) return 'Não pode vender mais goleiros.'
  if (rest.filter((p) => p.pos !== 'G').length < MIN_FIELD) return 'Não pode vender mais jogadores de campo.'
  return null
}

// Bloqueios de leilão
export function auctionBlockReason(state: GameState, team: Team, player: Player): string | null {
  if (player.auction) return 'Este jogador já está à venda em leilão.'
  if (player.blockedUntilSeason > state.seasonNumber) return 'Este jogador só pode ser vendido na próxima época.'
  if (player.noAuctionUntilRound >= state.currentMatchday) return 'Só pode tentar vender este jogador novamente no próximo jogo.'
  const sellBlock = canSell(team, player)
  if (sellBlock) return sellBlock
  return null
}

function logTransfer(state: GameState, player: Player, from: string, to: string, amount: number) {
  state.transferLog.unshift({
    season: state.season,
    round: state.currentMatchday + 1,
    playerName: player.name,
    fromTeam: from,
    toTeam: to,
    amount,
  })
  state.transferLog = state.transferLog.slice(0, 50)
}

export function executeTransfer(state: GameState, seller: Team, buyer: Team, player: Player, amount: number) {
  buyer.cash -= amount
  seller.cash += amount
  ledgerAdd(state, buyer, 'compra', -amount, `Compra de ${player.name} (${seller.short})`)
  ledgerAdd(state, seller, 'venda', amount, `Venda de ${player.name} para ${buyer.short}`)
  seller.players = seller.players.filter((p) => p.id !== player.id)
  seller.lineup = defaultLineup(seller.players)
  player.contractGames = 30
  player.salary = salaryDemand(player, state.inflation)
  player.forSale = false
  player.auction = null
  player.blockedUntilSeason = state.seasonNumber + 1 // só revende na próxima temporada
  buyer.players.push(player)
  logTransfer(state, player, seller.name, buyer.name, amount)
}

// Compra direta pelo preço-base
export function makeOffer(state: GameState, buyer: Team, seller: Team, player: Player, amount: number): OfferOutcome {
  const buyBlock = canBuy(buyer, player)
  if (buyBlock) return { accepted: false, price: amount, message: buyBlock }
  if (amount > buyer.cash) return { accepted: false, price: amount, message: 'Caixa insuficiente para essa oferta.' }

  const sellBlock = canSell(seller, player)
  if (sellBlock) return { accepted: false, price: amount, message: `${seller.name} não pode vender: elenco no limite mínimo.` }
  if (player.blockedUntilSeason > state.seasonNumber && !seller.isHuman) {
    return { accepted: false, price: amount, message: 'Este jogador só pode ser vendido na próxima época.' }
  }

  const value = playerValue(player, buyer, state.inflation)
  const isStarter = seller.lineup.includes(player.id)
  const minAccept = player.forSale ? value * 0.8 : isStarter ? value * 1.5 : value * 1.1
  if (amount < minAccept) {
    return { accepted: false, price: amount, message: `${seller.name} recusou a oferta por ${player.name}. Pedem mais.` }
  }

  executeTransfer(state, seller, buyer, player, amount)
  return { accepted: true, price: amount, message: `${player.name} transferido para ${buyer.name} por $${amount.toLocaleString('pt-BR')}!` }
}

// Colocar em leilão: resolve na rodada seguinte
export function putOnAuction(state: GameState, team: Team, player: Player, minPrice: number): OfferOutcome {
  const block = auctionBlockReason(state, team, player)
  if (block) return { accepted: false, price: minPrice, message: block }
  player.auction = { minPrice: Math.max(0, minPrice) }
  state.auctions.push({
    playerId: player.id,
    sellerTeamId: team.id,
    minPrice: Math.max(0, minPrice),
    createdRound: state.currentMatchday,
  })
  return {
    accepted: true,
    price: minPrice,
    message: `${player.name} colocado em leilão (lance mínimo $${minPrice.toLocaleString('pt-BR')}). Resolve na próxima rodada.`,
  }
}

export function cancelAuction(state: GameState, player: Player) {
  player.auction = null
  state.auctions = state.auctions.filter((a) => a.playerId !== player.id)
}

// Contratar agente livre (extensão nossa)
export function signFreeAgent(state: GameState, team: Team, player: Player): OfferOutcome {
  const buyBlock = canBuy(team, player)
  if (buyBlock) return { accepted: false, price: 0, message: buyBlock }
  const bonus = Math.round(playerValue(player, team, state.inflation) * 0.2)
  if (bonus > team.cash) return { accepted: false, price: bonus, message: 'Caixa insuficiente para pagar as luvas.' }
  team.cash -= bonus
  ledgerAdd(state, team, 'luvas', -bonus, `Luvas: contratação de ${player.name}`)
  state.freeAgents = state.freeAgents.filter((p) => p.id !== player.id)
  player.contractGames = 30
  player.salary = salaryDemand(player, state.inflation)
  player.blockedUntilSeason = state.seasonNumber + 1
  team.players.push(player)
  logTransfer(state, player, 'Sem clube', team.name, bonus)
  return { accepted: true, price: bonus, message: `${player.name} assinou com ${team.name} (luvas: $${bonus.toLocaleString('pt-BR')}).` }
}

// Renovação: aceita se novo salário ≥ pretendido; bloqueia venda até a próxima temporada
export function renewContract(state: GameState, team: Team, player: Player, newSalary: number): OfferOutcome {
  const demanded = salaryDemand(player, state.inflation)
  if (newSalary < demanded) {
    return { accepted: false, price: demanded, message: `Nem pensar! Exijo $${demanded.toLocaleString('pt-BR')} por jogo.` }
  }
  player.salary = newSalary
  player.contractGames = 30
  player.blockedUntilSeason = state.seasonNumber + 1
  ledgerAdd(state, team, 'luvas', 0, `Renovação de ${player.name} (salário $${newSalary.toLocaleString('pt-BR')})`)
  return { accepted: true, price: newSalary, message: `${player.name} renovou por mais 30 jogos (salário $${newSalary.toLocaleString('pt-BR')}/jogo).` }
}

export function toggleForSale(player: Player) {
  player.forSale = !player.forSale
}

export function firePlayer(team: Team, state: GameState, player: Player): OfferOutcome {
  const sellBlock = canSell(team, player)
  if (sellBlock) return { accepted: false, price: 0, message: sellBlock }
  const cost = Math.round((player.contractGames * player.salary) / 2)
  if (cost > team.cash) return { accepted: false, price: cost, message: 'Caixa insuficiente para rescindir.' }
  team.cash -= cost
  ledgerAdd(state, team, 'rescisao', -cost, `Rescisão de ${player.name}`)
  team.players = team.players.filter((p) => p.id !== player.id)
  team.lineup = defaultLineup(team.players)
  player.contractGames = 0
  state.freeAgents.push(player)
  return { accepted: true, price: cost, message: `${player.name} rescindiu contrato (custo: $${cost.toLocaleString('pt-BR')}).` }
}

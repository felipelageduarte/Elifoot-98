import type { Auction, GameState, Player, Team } from './types'
import { playerValue, executeTransfer, canBuy } from './transfers'
import { rand, random, shuffle } from './rng'

// Leilão: colocado numa rodada, resolve na seguinte.
// Ofertas de IA + ofertas humanas (recolhidas pela UI).

export interface AuctionLot {
  auction: Auction
  player: Player
  seller: Team
  aiBids: { teamId: number; amount: number }[]
}

export function findAuctionPlayer(state: GameState, auction: Auction): Player | null {
  const seller = state.teams[auction.sellerTeamId]
  return seller?.players.find((p) => p.id === auction.playerId) ?? null
}

// Lotes a resolver nesta rodada (criados em rodadas anteriores)
export function pendingLots(state: GameState): AuctionLot[] {
  const lots: AuctionLot[] = []
  for (const auction of state.auctions) {
    if (auction.createdRound >= state.currentMatchday) continue
    const seller = state.teams[auction.sellerTeamId]
    const player = findAuctionPlayer(state, auction)
    if (!seller || !player) continue
    lots.push({ auction, player, seller, aiBids: collectAiBids(state, auction, player, seller) })
  }
  return lots
}

// IA oferta se precisa da posição/elenco curto e tem caixa
function collectAiBids(state: GameState, auction: Auction, player: Player, seller: Team): { teamId: number; amount: number }[] {
  const bids: { teamId: number; amount: number }[] = []
  const value = playerValue(player, undefined, state.inflation)
  for (const team of shuffle(Object.values(state.teams))) {
    if (team.isHuman || team.id === seller.id) continue
    if (canBuy(team, player) !== null) continue
    const needsSquad = team.players.length < 20
    const posCount = team.players.filter((p) => p.pos === player.pos).length
    const needsPos = posCount < 2
    const avgStr = team.players.reduce((s, p) => s + p.strength, 0) / Math.max(1, team.players.length)
    const goodEnough = player.strength >= avgStr - 3
    // distritais só compram barato
    const distrital = team.division > 4
    const maxSpend = distrital ? 200000 : team.cash * 0.6

    if ((needsSquad || needsPos) && goodEnough) {
      const bid = Math.round(Math.min(maxSpend, value * (1 + random(41) / 100)))
      if (bid >= auction.minPrice && bid <= team.cash && bid > 0) {
        bids.push({ teamId: team.id, amount: bid })
        if (bids.length >= 4) break
      }
    }
  }
  return bids
}

export interface AuctionResolution {
  playerName: string
  sellerName: string
  message: string
  soldTo: string | null
  amount: number
}

// Resolve um lote com as ofertas humanas coletadas pela UI
export function resolveLot(
  state: GameState,
  lot: AuctionLot,
  humanBids: { teamId: number; amount: number }[],
): AuctionResolution {
  const allBids = [...lot.aiBids, ...humanBids]
    .filter((b) => {
      const t = state.teams[b.teamId]
      return t && b.amount >= lot.auction.minPrice && b.amount <= t.cash && canBuy(t, lot.player) === null
    })
    .sort((a, b) => b.amount - a.amount || (rand() < 0.5 ? -1 : 1))

  state.auctions = state.auctions.filter((a) => a.playerId !== lot.auction.playerId)

  if (allBids.length === 0) {
    lot.player.auction = null
    lot.player.noAuctionUntilRound = state.currentMatchday // só no próximo jogo
    return {
      playerName: lot.player.name,
      sellerName: lot.seller.name,
      message: `Não houve ofertas por ${lot.player.name}.`,
      soldTo: null,
      amount: 0,
    }
  }

  const winner = allBids[0]
  const buyer = state.teams[winner.teamId]
  executeTransfer(state, lot.seller, buyer, lot.player, winner.amount)

  // "Últimas do mercado": qualquer venda em leilão vira notícia — inclui
  // movimentações entre clubes controlados pela IA, como no original.
  state.news.unshift({
    round: state.currentMatchday + 1,
    season: state.season,
    text: `🔄 Mercado: ${lot.player.name} foi vendido pelo ${lot.seller.short} ao ${buyer.short} por $${winner.amount.toLocaleString('pt-BR')}.`,
  })

  return {
    playerName: lot.player.name,
    sellerName: lot.seller.name,
    message: `${lot.player.name}: vendido ao ${buyer.name} por $${winner.amount.toLocaleString('pt-BR')}.`,
    soldTo: buyer.name,
    amount: winner.amount,
  }
}

// Caixa negativo → vende automaticamente (leilão sem lance mínimo)
// um jogador com contrato prestes a expirar, um por rodada
export function autoSellForDebt(state: GameState, team: Team): string | null {
  if (team.cash >= 0) return null
  const candidates = team.players
    .filter((p) => !p.auction && p.contractGames <= 5 && p.blockedUntilSeason <= state.seasonNumber)
    .sort((a, b) => playerValue(b) - playerValue(a))
  const victim = candidates[0]
  if (!victim) return null
  const rest = team.players.filter((p) => p.id !== victim.id)
  if (rest.length < 11 || rest.filter((p) => p.pos === 'G').length < 1) return null
  victim.auction = { minPrice: 0 }
  state.auctions.push({ playerId: victim.id, sellerTeamId: team.id, minPrice: 0, createdRound: state.currentMatchday })
  return `💸 ${team.name} está endividado: ${victim.name} foi posto à venda em leilão sem lance mínimo!`
}

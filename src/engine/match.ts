import type { MatchEvent, MatchResult, PenaltyShootout, Player, Team } from './types'
import { BEHAVIOR_CARD_WEIGHTS, playerDisplayName } from './types'
import { rand, random, randInt } from './rng'
import type { MatchReferee } from './referees'
import type { Calibration } from './calibration'
import { DEFAULT_CALIBRATION } from './calibration'

// ------------------------------------------------------------------
// Motor de simulação minuto a minuto (1-90):
//  - Força entra dobrada no setor + bônus +3 nacionalidade + ajuda do árbitro
//  - Médios 50% ataque / 50% defesa
//  - Mando assimétrico: Random(6000) casa vs Random(7000) fora (6500 neutro)
//  - Gerador secundário anti-goleada
//  - Duelo individual Random(F_atk) vs Random(F_def) com sorteio ponderado
//  - Desfechos: GOLO/Defendeu/Ao poste/À barra/Ao lado/Por cima
//  - Craque `*`: +25% na finalização e no pênalti
//  - Comportamento: roleta de cartões com pesos 10/7/4/2/1/0
//  - Pênaltis em jogo (humano escolhe o cobrador) e shootout na taça
// ------------------------------------------------------------------

// Calibração ativa do motor — ajustável em Configurações → Calibração
// (ver src/engine/calibration.ts). setMatchCalibration() é chamado pela
// UI sempre que o usuário muda um valor ou carrega o jogo.
let CAL: Calibration = { ...DEFAULT_CALIBRATION }

export function setMatchCalibration(c: Calibration) {
  CAL = c
}

export function getMatchCalibration(): Calibration {
  return CAL
}

interface SimSide {
  team: Team
  starters: Player[]
  yellowsInMatch: Set<number>
  goals: number
  shots: number
}

export interface MatchSim {
  home: SimSide
  away: SimSide
  homeBench: Player[]
  awayBench: Player[]
  minute: number
  events: MatchEvent[]
  subsUsed: Record<number, number>
  subbedOut: number[] // jogadores substituídos não podem voltar (regra do futebol)
  attendance: number
  gate: number
  finished: boolean
  neutral: boolean
  isCup: boolean
  referee: MatchReferee
  pendingHumanInjury: { teamId: number; playerId: number } | null
  // pênalti aguardando escolha do cobrador por técnico humano
  pendingHumanPenalty: { teamId: number } | null
  shootout: PenaltyShootout | null
  // contadores para o painel de estatísticas (Histórico → Estatísticas)
  yellowCards: number
  redCards: number
  penaltiesAwarded: number
  penaltiesScored: number
  injuries: number
}

function effStrength(p: Player): number {
  return p.strength
}

function nationalityBonus(side: SimSide): number {
  return side.starters.filter((p) => p.nationality === side.team.country).length * 3
}

// Força dobrada por titular + bônus, médios contribuem 50/50 ataque/defesa
function attackStrength(sim: MatchSim, side: SimSide): number {
  const bonus = nationalityBonus(side)
  const atk = side.starters.filter((p) => p.pos === 'A').reduce((s, p) => s + p.strength * 2, 0)
  const mid = side.starters.filter((p) => p.pos === 'M').reduce((s, p) => s + p.strength * 2, 0)
  const aid = side === sim.home ? sim.referee.homeAid : sim.referee.awayAid
  return atk + mid / 2 + bonus + (aid - 10)
}

function defenseStrength(sim: MatchSim, side: SimSide): number {
  const bonus = nationalityBonus(side)
  const def = side.starters.filter((p) => p.pos === 'D').reduce((s, p) => s + p.strength * 2, 0)
  const mid = side.starters.filter((p) => p.pos === 'M').reduce((s, p) => s + p.strength * 2, 0)
  const gk = keeperStrength(side) * 2
  const aid = side === sim.home ? sim.referee.homeAid : sim.referee.awayAid
  return def + mid / 2 + gk + bonus + (aid - 10)
}

// Sem goleiro disponível, um jogador de linha assume a baliza com penalidade
function keeperStrength(side: SimSide): number {
  const gk = side.starters.find((p) => p.pos === 'G')
  if (gk) return gk.strength
  const stand = side.starters.slice().sort((a, b) => b.strength - a.strength)[0]
  return stand ? Math.max(1, stand.strength - 4) : 1
}

function keeperName(side: SimSide): string {
  const gk = side.starters.find((p) => p.pos === 'G')
  return gk ? gk.name : 'o goleiro improvisado'
}

function weightedPick(players: Player[], weight: (p: Player) => number): Player | null {
  const total = players.reduce((s, p) => s + weight(p), 0)
  if (total <= 0) return null
  let r = rand() * total
  for (const p of players) {
    r -= weight(p)
    if (r <= 0) return p
  }
  return players[players.length - 1] ?? null
}

// Pesos do sorteio de finalizador — atacante A3/M2/D1, defensor D3/M2/A1; craque ×1.5
function pickAttacker(side: SimSide): Player | null {
  return weightedPick(
    side.starters.filter((p) => p.pos !== 'G'),
    (p) => ({ A: 3, M: 2, D: 1, G: 0 }[p.pos]) * effStrength(p) * (p.star ? 1.5 : 1),
  )
}

function pickDefender(side: SimSide): Player | null {
  return weightedPick(
    side.starters.filter((p) => p.pos !== 'G'),
    (p) => ({ D: 3, M: 2, A: 1, G: 0 }[p.pos]) * effStrength(p),
  )
}

function shotOutcome(sim: MatchSim, att: SimSide, def: SimSide, shooter: Player, minute: number) {
  const gkStr = keeperStrength(def)
  const starBonus = shooter.star ? shooter.strength * (CAL.starBonusPercent / 100) : 0
  const pGoal = (CAL.goalConversionFactor * (shooter.strength + starBonus)) / (shooter.strength + gkStr)

  if (rand() < pGoal) {
    att.goals++
    shooter.goals++
    shooter.history.goals++
    sim.events.push({
      minute,
      type: 'goal',
      teamId: att.team.id,
      playerId: shooter.id,
      text: `⚽ GOOOL! ${playerDisplayName(shooter)} marca para ${att.team.name}!`,
    })
    return
  }
  // restante: Defendeu 40%, Ao lado 20%, Por cima 20%, poste 10%, barra 10%
  const miss = rand()
  if (miss < 0.4) {
    sim.events.push({
      minute, type: 'save', teamId: att.team.id, playerId: shooter.id,
      text: `🧤 ${keeperName(def)} defende a finalização de ${playerDisplayName(shooter)}.`,
    })
  } else if (miss < 0.6) {
    sim.events.push({
      minute, type: 'wide', teamId: att.team.id, playerId: shooter.id,
      text: `${playerDisplayName(shooter)} chuta ao lado.`,
    })
  } else if (miss < 0.8) {
    sim.events.push({
      minute, type: 'over', teamId: att.team.id, playerId: shooter.id,
      text: `${playerDisplayName(shooter)} chuta por cima.`,
    })
  } else if (miss < 0.9) {
    sim.events.push({
      minute, type: 'post', teamId: att.team.id, playerId: shooter.id,
      text: `😱 ${playerDisplayName(shooter)} acerta o POSTE!`,
    })
  } else {
    sim.events.push({
      minute, type: 'bar', teamId: att.team.id, playerId: shooter.id,
      text: `😱 ${playerDisplayName(shooter)} acerta a TRAVE!`,
    })
  }
}

function resolveChance(sim: MatchSim, att: SimSide, def: SimSide, minute: number) {
  att.shots++ // conta a chance gerada (alimenta o gerador anti-goleada)
  const shooter = pickAttacker(att)
  const defender = pickDefender(def)
  if (!shooter) return
  // duelo individual entre atacante e defensor
  if (defender && random(Math.max(1, defender.strength)) > random(Math.max(1, shooter.strength))) {
    return // desarme — depende só da força nominal
  }
  shotOutcome(sim, att, def, shooter, minute)
}

// Pênalti — retorna true se convertido
export function takePenalty(sim: MatchSim, side: SimSide | number, taker: Player): boolean {
  const attSide = typeof side === 'number' ? (sim.home.team.id === side ? sim.home : sim.away) : side
  const defSide = attSide === sim.home ? sim.away : sim.home
  const minute = sim.minute
  const eff = taker.strength * (taker.star ? 1.3 : 1) * (taker.pos === 'M' || taker.pos === 'A' ? 1 : 0.7)
  const gk = keeperStrength(defSide)
  const pGoal = Math.min(0.95, Math.max(0.4, (CAL.penaltyConversionFactor * eff) / (eff + gk * 0.4)))

  if (rand() < pGoal) {
    attSide.goals++
    taker.goals++
    taker.history.goals++
    sim.penaltiesScored++
    sim.events.push({
      minute, type: 'pen_goal', teamId: attSide.team.id, playerId: taker.id,
      text: `⚽ GOOOL de pênalti! ${playerDisplayName(taker)} converte para ${attSide.team.name}! (pen.)`,
    })
    return true
  }
  const miss = rand()
  const how = miss < 0.6 ? `${keeperName(defSide)} DEFENDE` : miss < 0.75 ? 'na trave' : miss < 0.85 ? 'no poste' : 'para fora — não marcado'
  sim.events.push({
    minute, type: 'pen_miss', teamId: attSide.team.id, playerId: taker.id,
    text: `❌ Pênalti perdido! ${playerDisplayName(taker)} cobra e ${how}!`,
  })
  return false
}

// IA escolhe cobrador: maior força efetiva
export function aiPenaltyTaker(side: SimSide): Player {
  return side.starters
    .slice()
    .sort(
      (a, b) =>
        b.strength * (b.star ? 1.3 : 1) * (b.pos === 'M' || b.pos === 'A' ? 1 : 0.7) -
        a.strength * (a.star ? 1.3 : 1) * (a.pos === 'M' || a.pos === 'A' ? 1 : 0.7),
    )[0]
}

function checkFouls(sim: MatchSim, att: SimSide, def: SimSide, minute: number) {
  // falta com probabilidade configurável por lado defensor
  if (random(100) >= CAL.foulChancePercent) return
  const infractor = weightedPick(def.starters, (p) => BEHAVIOR_CARD_WEIGHTS[p.behavior])
  if (!infractor) return // time 100% Fair play nunca comete falta punível

  const roll = random(100)
  if (roll < CAL.cardFractionPercent) {
    // cartão
    if (def.yellowsInMatch.has(infractor.id)) {
      // segundo amarelo = vermelho
      def.yellowsInMatch.delete(infractor.id)
      def.starters = def.starters.filter((p) => p.id !== infractor.id)
      infractor.suspendedGames = Math.max(infractor.suspendedGames, randInt(1, 3))
      infractor.history.reds++
      sim.redCards++
      sim.events.push({
        minute, type: 'red', teamId: def.team.id, playerId: infractor.id,
        text: `🟥 Segundo amarelo! ${playerDisplayName(infractor)} (${def.team.short}) está EXPULSO! Suspenso por ${infractor.suspendedGames} jogos.`,
      })
    } else if (random(100) < CAL.redDirectPercent) {
      // vermelho direto
      def.starters = def.starters.filter((p) => p.id !== infractor.id)
      infractor.suspendedGames = Math.max(infractor.suspendedGames, randInt(1, 3))
      infractor.history.reds++
      sim.redCards++
      sim.events.push({
        minute, type: 'red', teamId: def.team.id, playerId: infractor.id,
        text: `🟥 Vermelho direto! ${playerDisplayName(infractor)} (${def.team.short}) expulso por entrada violenta! Suspenso por ${infractor.suspendedGames} jogos.`,
      })
    } else {
      def.yellowsInMatch.add(infractor.id)
      infractor.yellowCards++
      sim.yellowCards++
      sim.events.push({
        minute, type: 'yellow', teamId: def.team.id, playerId: infractor.id,
        text: `🟨 Cartão amarelo para ${playerDisplayName(infractor)} (${def.team.short}).`,
      })
      if (infractor.yellowCards >= 3) {
        infractor.yellowCards = 0
        infractor.suspendedGames = Math.max(infractor.suspendedGames, 1)
      }
    }
  } else if (roll < CAL.cardFractionPercent + CAL.penaltyFractionPercent) {
    // pênalti a favor do atacante (falta na área)
    sim.penaltiesAwarded++
    sim.events.push({
      minute, type: 'pen_miss', teamId: att.team.id, playerId: null,
      text: `⚠️ PÊNALTI para ${att.team.name}!`,
    })
    if (att.team.isHuman) {
      sim.pendingHumanPenalty = { teamId: att.team.id }
    } else {
      takePenalty(sim, att, aiPenaltyTaker(att))
    }
  }
}

function checkInjury(sim: MatchSim, side: SimSide, bench: Player[], minute: number) {
  if (random(1000) >= CAL.injuryChancePer1000) return
  const player = side.starters[random(side.starters.length)]
  if (!player) return
  player.injuredGames = randInt(1, 6)
  player.history.injuries++
  sim.injuries++
  // lesão pode reduzir força
  const drop = randInt(0, 3)
  if (drop > 0) player.strength = Math.max(1, player.strength - drop)
  side.starters = side.starters.filter((p) => p.id !== player.id)
  sim.events.push({
    minute, type: 'injury', teamId: side.team.id, playerId: player.id,
    text: `🚑 ${playerDisplayName(player)} (${side.team.short}) se machucou e sai de campo (${player.injuredGames} jogos fora).`,
  })

  if (side.team.isHuman) {
    if ((sim.subsUsed[side.team.id] ?? 0) < CAL.maxSubstitutions && bench.some((p) => p.injuredGames === 0 && p.suspendedGames === 0)) {
      sim.pendingHumanInjury = { teamId: side.team.id, playerId: player.id }
    }
    return
  }

  if ((sim.subsUsed[side.team.id] ?? 0) >= CAL.maxSubstitutions) return
  const samePos = bench
    .filter((p) => p.pos === player.pos && p.suspendedGames === 0 && p.injuredGames === 0)
    .sort((a, b) => b.strength - a.strength)[0]
  const sub =
    samePos ??
    bench.filter((p) => p.suspendedGames === 0 && p.injuredGames === 0).sort((a, b) => b.strength - a.strength)[0]
  if (sub) {
    side.starters.push(sub)
    bench.splice(bench.indexOf(sub), 1)
    sim.subsUsed[side.team.id] = (sim.subsUsed[side.team.id] ?? 0) + 1
    sim.events.push({
      minute, type: 'sub', teamId: side.team.id, playerId: sub.id,
      text: `🔁 Entra ${playerDisplayName(sub)} no lugar de ${playerDisplayName(player)}.`,
    })
  }
}

// Procura pela partida depende da força média das DUAS equipes
export function computeAttendance(home: Team, away: Team, inflation: number): number {
  const avg = (t: Team) => {
    const starters = t.lineup.map((id) => t.players.find((p) => p.id === id)).filter((p): p is Player => !!p)
    if (starters.length === 0) return 10
    return starters.reduce((s, p) => s + p.strength, 0) / starters.length
  }
  const fm = (avg(home) + avg(away)) / 2
  const divFactor = [1.0, 0.8, 0.6, 0.45][Math.min(home.division, 4) - 1] ?? 0.3
  const demandBase = (2000 + 900 * fm) * divFactor
  // preço do ingresso ajustado pelo usuário modula a procura
  const fairPrice = (5 + fm * 0.5) * inflation
  const priceFactor = Math.max(0.25, Math.min(1.3, fairPrice / Math.max(1, home.ticketPrice)))
  const fanBoost = Math.min(2, 0.5 + home.fanCount / 200000)
  const demand = demandBase * priceFactor * fanBoost * (randInt(85, 115) / 100)
  return Math.min(home.stadiumCapacity, Math.max(500, Math.round(demand)))
}

export function createMatchSim(
  home: Team,
  away: Team,
  referee: MatchReferee,
  inflation: number,
  opts: { neutral?: boolean; isCup?: boolean } = {},
): MatchSim {
  const getStarters = (t: Team) =>
    t.lineup
      .map((id) => t.players.find((p) => p.id === id))
      .filter((p): p is Player => !!p && p.suspendedGames === 0 && p.injuredGames === 0)

  const homeSide: SimSide = { team: home, starters: getStarters(home), yellowsInMatch: new Set(), goals: 0, shots: 0 }
  const awaySide: SimSide = { team: away, starters: getStarters(away), yellowsInMatch: new Set(), goals: 0, shots: 0 }

  for (const side of [homeSide, awaySide]) {
    for (const p of side.starters) side.team.players.find((x) => x.id === p.id)!.history.games++
  }

  const attendance = computeAttendance(home, away, inflation)

  return {
    home: homeSide,
    away: awaySide,
    homeBench: home.players.filter((p) => !homeSide.starters.includes(p)),
    awayBench: away.players.filter((p) => !awaySide.starters.includes(p)),
    minute: 0,
    events: [{ minute: 0, type: 'start', teamId: null, playerId: null, text: `🏟️ Começa a partida! Árbitro: ${referee.name}.` }],
    subsUsed: { [home.id]: 0, [away.id]: 0 },
    subbedOut: [],
    attendance,
    gate: attendance * home.ticketPrice,
    finished: false,
    neutral: opts.neutral ?? false,
    isCup: opts.isCup ?? false,
    referee,
    pendingHumanInjury: null,
    pendingHumanPenalty: null,
    shootout: null,
    yellowCards: 0,
    redCards: 0,
    penaltiesAwarded: 0,
    penaltiesScored: 0,
    injuries: 0,
  }
}

export function stepMinute(sim: MatchSim): MatchEvent[] {
  if (sim.finished) return []
  sim.minute++
  const minute = sim.minute
  const before = sim.events.length

  const homeDivisor = sim.neutral ? CAL.neutralDivisor : CAL.homeDivisor
  const awayDivisor = sim.neutral ? CAL.neutralDivisor : CAL.awayDivisor

  // chance principal + gerador secundário anti-goleada
  const homeChance =
    random(homeDivisor) < attackStrength(sim, sim.home) ||
    random(90) < CAL.antiRoutLimit - (sim.home.shots + sim.home.goals) ||
    random(180) === 0
  const awayChance =
    random(awayDivisor) < attackStrength(sim, sim.away) ||
    random(120) < CAL.antiRoutLimit - (sim.away.shots + sim.away.goals) ||
    random(270) === 0

  if (homeChance) resolveChance(sim, sim.home, sim.away, minute)
  if (awayChance && !sim.pendingHumanPenalty) resolveChance(sim, sim.away, sim.home, minute)

  if (!sim.pendingHumanPenalty) {
    checkFouls(sim, sim.home, sim.away, minute) // falta do visitante, ataque da casa
    if (!sim.pendingHumanPenalty) checkFouls(sim, sim.away, sim.home, minute)
  }
  checkInjury(sim, sim.home, sim.homeBench, minute)
  checkInjury(sim, sim.away, sim.awayBench, minute)

  if (minute === 45) {
    sim.events.push({ minute: 45, type: 'half', teamId: null, playerId: null, text: '⏸️ Fim do primeiro tempo.' })
  }
  if (minute >= 90) {
    if (sim.isCup && sim.home.goals === sim.away.goals && !sim.pendingHumanPenalty) {
      runShootout(sim)
    }
    if (!sim.pendingHumanPenalty) {
      sim.finished = true
      const so = sim.shootout ? ` (${sim.shootout.homeGoals} x ${sim.shootout.awayGoals} nos pênaltis)` : ''
      sim.events.push({
        minute: 90, type: 'end', teamId: null, playerId: null,
        text: `🏁 Fim de jogo: ${sim.home.team.name} ${sim.home.goals} x ${sim.away.goals} ${sim.away.team.name}${so}`,
      })
    }
  }
  return sim.events.slice(before)
}

// Desempate por pênaltis: 5 cobranças alternadas + morte súbita
function runShootout(sim: MatchSim) {
  const shootout: PenaltyShootout = { homeGoals: 0, awayGoals: 0, sequence: [] }
  const takers = (side: SimSide) =>
    side.starters.slice().sort((a, b) => b.strength * (b.star ? 1.3 : 1) - a.strength * (a.star ? 1.3 : 1))

  const homeTakers = takers(sim.home)
  const awayTakers = takers(sim.away)
  const gkH = keeperStrength(sim.home)
  const gkA = keeperStrength(sim.away)

  const kick = (taker: Player, gk: number): boolean => {
    const eff = taker.strength * (taker.star ? 1.3 : 1)
    const p = Math.min(0.92, Math.max(0.4, (CAL.shootoutConversionFactor * eff) / (eff + gk * 0.5)))
    return rand() < p
  }

  let round = 0
  while (true) {
    const ht = homeTakers[round % homeTakers.length]
    const at = awayTakers[round % awayTakers.length]
    const hs = kick(ht, gkA)
    if (hs) shootout.homeGoals++
    shootout.sequence.push({ teamId: sim.home.team.id, scored: hs, taker: playerDisplayName(ht) })

    // encerramento antecipado matemático nas 5 primeiras
    const kicksLeftAway = round < 5 ? 5 - round : 1
    if (!(round < 4 && Math.abs(shootout.homeGoals - shootout.awayGoals) > kicksLeftAway)) {
      const as = kick(at, gkH)
      if (as) shootout.awayGoals++
      shootout.sequence.push({ teamId: sim.away.team.id, scored: as, taker: playerDisplayName(at) })
    }

    round++
    if (round >= 5 && shootout.homeGoals !== shootout.awayGoals) break
    if (round > 20) {
      shootout.homeGoals++ // segurança
      break
    }
  }
  sim.shootout = shootout
  const winner = shootout.homeGoals > shootout.awayGoals ? sim.home.team : sim.away.team
  sim.events.push({
    minute: 90, type: 'pen_goal', teamId: winner.id, playerId: null,
    text: `🥅 Desempate por pênaltis: ${sim.home.team.short} ${shootout.homeGoals} x ${shootout.awayGoals} ${sim.away.team.short} — ${winner.name} avança! (v. pen.)`,
  })
}

export function fieldPlayers(sim: MatchSim, teamId: number): Player[] {
  return (sim.home.team.id === teamId ? sim.home : sim.away).starters
}

export function benchPlayers(sim: MatchSim, teamId: number): Player[] {
  const bench = sim.home.team.id === teamId ? sim.homeBench : sim.awayBench
  return bench.filter((p) => p.suspendedGames === 0 && p.injuredGames === 0 && !sim.subbedOut.includes(p.id))
}

export function subsLeft(sim: MatchSim, teamId: number): number {
  return CAL.maxSubstitutions - (sim.subsUsed[teamId] ?? 0)
}

// Substituição forçada por lesão: o lesionado
// JÁ saiu de campo — o técnico só escolhe quem entra.
export function forcedSubstitute(sim: MatchSim, teamId: number, inId: number): string | null {
  if (sim.finished) return 'A partida já terminou.'
  const side = sim.home.team.id === teamId ? sim.home : sim.away
  const bench = sim.home.team.id === teamId ? sim.homeBench : sim.awayBench
  if ((sim.subsUsed[teamId] ?? 0) >= CAL.maxSubstitutions) return `Limite de ${CAL.maxSubstitutions} substituições atingido.`
  const sub = bench.find((p) => p.id === inId)
  if (!sub) return 'Jogador não está no banco.'
  if (sub.suspendedGames > 0 || sub.injuredGames > 0) return `${sub.name} não pode entrar (suspenso/machucado).`
  if (sim.subbedOut.includes(sub.id)) return `${sub.name} já foi substituído e não pode voltar.`

  side.starters.push(sub)
  bench.splice(bench.indexOf(sub), 1)
  sim.subsUsed[teamId] = (sim.subsUsed[teamId] ?? 0) + 1
  sub.history.games++
  sim.pendingHumanInjury = null
  sim.events.push({
    minute: sim.minute, type: 'sub', teamId, playerId: sub.id,
    text: `🔁 Entra ${playerDisplayName(sub)} no lugar do lesionado.`,
  })
  return null
}

export function substitute(sim: MatchSim, teamId: number, outId: number, inId: number): string | null {
  if (sim.finished) return 'A partida já terminou.'
  const side = sim.home.team.id === teamId ? sim.home : sim.away
  const bench = sim.home.team.id === teamId ? sim.homeBench : sim.awayBench
  if ((sim.subsUsed[teamId] ?? 0) >= CAL.maxSubstitutions) return `Limite de ${CAL.maxSubstitutions} substituições atingido.`
  const out = side.starters.find((p) => p.id === outId)
  if (!out) return 'Jogador não está em campo.'
  const sub = bench.find((p) => p.id === inId)
  if (!sub) return 'Jogador não está no banco.'
  if (sub.suspendedGames > 0 || sub.injuredGames > 0) return `${sub.name} não pode entrar (suspenso/machucado).`
  if (sim.subbedOut.includes(sub.id)) return `${sub.name} já foi substituído e não pode voltar.`

  side.starters = side.starters.filter((p) => p.id !== outId)
  side.starters.push(sub)
  bench.splice(bench.indexOf(sub), 1)
  bench.push(out)
  sim.subbedOut.push(out.id)
  sim.subsUsed[teamId] = (sim.subsUsed[teamId] ?? 0) + 1
  sub.history.games++
  if (sim.pendingHumanInjury?.teamId === teamId) sim.pendingHumanInjury = null
  sim.events.push({
    minute: sim.minute, type: 'sub', teamId, playerId: sub.id,
    text: `🔁 Substituição no ${side.team.short}: sai ${playerDisplayName(out)}, entra ${playerDisplayName(sub)}.`,
  })
  return null
}

export function finalizeResult(sim: MatchSim): MatchResult {
  return {
    homeId: sim.home.team.id,
    awayId: sim.away.team.id,
    homeGoals: sim.home.goals,
    awayGoals: sim.away.goals,
    events: sim.events,
    attendance: sim.attendance,
    gate: sim.gate,
    referee: sim.referee.name,
    neutral: sim.neutral,
    shootout: sim.shootout,
    yellowCards: sim.yellowCards,
    redCards: sim.redCards,
    penaltiesAwarded: sim.penaltiesAwarded,
    penaltiesScored: sim.penaltiesScored,
    injuries: sim.injuries,
  }
}

// Simulação instantânea (IA e testes)
export function simulateMatch(
  home: Team,
  away: Team,
  referee: MatchReferee,
  inflation: number,
  opts: { neutral?: boolean; isCup?: boolean } = {},
): MatchResult {
  const sim = createMatchSim(home, away, referee, inflation, opts)
  while (!sim.finished) {
    stepMinute(sim)
    if (sim.pendingHumanPenalty) {
      const side = sim.home.team.id === sim.pendingHumanPenalty.teamId ? sim.home : sim.away
      sim.pendingHumanPenalty = null
      takePenalty(sim, side, aiPenaltyTaker(side))
    }
    sim.pendingHumanInjury = null
  }
  return finalizeResult(sim)
}

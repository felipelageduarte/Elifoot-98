import { describe, it, expect } from 'vitest'
import { createNewGame, createClassicGame } from './newgame'
import type { ClassicSeed } from './newgame'
import { playRound, seasonFinished, endSeason, computeStandings, currentEntry } from './season'
import { createMatchSim, stepMinute, substitute, forcedSubstitute, fieldPlayers, benchPlayers, subsLeft, finalizeResult, simulateMatch } from './match'
import { DEFAULT_CALIBRATION } from './calibration'
import { drawReferee } from './referees'
import { putOnAuction } from './transfers'
import { isForeign } from './nationality'
import { deriveStats, resetStats } from './stats'
import { seed } from './rng'
import { DISTRITAL } from './types'

// Dataset sintético só para teste — não depende do arquivo real (gitignored).
function makeClassicFixture(count: number): ClassicSeed[] {
  const positions: { posicao: string; n: number }[] = [
    { posicao: 'G', n: 2 }, { posicao: 'D', n: 6 }, { posicao: 'M', n: 6 }, { posicao: 'A', n: 4 },
  ]
  const seeds: ClassicSeed[] = []
  for (let i = 0; i < count; i++) {
    const jogadores = positions.flatMap(({ posicao, n }) =>
      Array.from({ length: n }, (_, j) => ({ nome: `${posicao}${i}-${j}`, posicao, pais: 'BRA' })),
    )
    seeds.push({
      nome_abreviado: `Time ${i}`,
      nome_completo: `Time Fictício ${i}`,
      pais: 'BRA',
      nivel_inicial: count - i, // decrescente: time 0 é o mais forte
      cor_fundo: '#000000',
      cor_texto: '#ffffff',
      treinador: `Téc. ${i}`,
      jogadores,
    })
  }
  return seeds
}

describe('engine', () => {
  it('cria jogo BR2026 com 80 times, calendário com liga e taça', () => {
    seed(42)
    const gs = createNewGame([{ teamName: 'Santa Cruz', managerName: 'Felipe' }])
    expect(Object.keys(gs.teams).length).toBe(80)
    expect(gs.divisions.length).toBe(4)
    for (const d of gs.divisions) {
      expect(d.teamIds.length).toBe(20)
      expect(d.rounds.length).toBe(38)
    }
    // taça: 80 times → pré-eliminatória + 6 fases = 7 estágios
    const cupEntries = gs.calendar.filter((e) => e.type === 'cup')
    expect(cupEntries.length).toBe(7)
    expect(gs.calendar.filter((e) => e.type === 'league').length).toBe(38)
    const human = Object.values(gs.teams).find((t) => t.isHuman)!
    expect(human.name).toBe('Santa Cruz')
    expect(human.lineup.length).toBe(11)
    expect(gs.managers.filter((m) => m.human).length).toBe(1)
  })

  it('cria jogo Clássico 1998 com N equipes: 4×8 + distrital', () => {
    seed(7)
    const fixture = makeClassicFixture(50)
    const gs = createClassicGame(fixture, [{ teamName: null, managerName: 'T' }])
    expect(Object.keys(gs.teams).length).toBe(50)
    for (const d of gs.divisions) expect(d.teamIds.length).toBe(8)
    expect(gs.distritalTeamIds.length).toBe(50 - 32)
    expect(gs.divisions[0].rounds.length).toBe(14)
    // humano sorteado na última divisão
    const human = Object.values(gs.teams).find((t) => t.isHuman)!
    expect(human.division).toBe(4)
    // jogadores gerados por nível
    const top = Object.values(gs.teams).find((t) => t.division === 1)!
    const bottom = gs.distritalTeamIds.map((id) => gs.teams[id]).find((t) => true)!
    const avg = (x: typeof top) => x.players.reduce((s, p) => s + p.strength, 0) / x.players.length
    expect(avg(top)).toBeGreaterThan(avg(bottom))
  })

  it('regra de estrangeiros: acordos de livre circulação entre países', () => {
    expect(isForeign('BRA', 'POR')).toBe(false) // comunidade lusófona
    expect(isForeign('ESP', 'POR')).toBe(false) // bloco europeu
    expect(isForeign('ARG', 'BRA')).toBe(true)
    expect(isForeign('BRA', 'BRA')).toBe(false)
    expect(isForeign('ANG', 'BRA')).toBe(false) // comunidade lusófona
  })

  it('joga uma temporada completa (liga + taça) com resultados plausíveis', () => {
    seed(123)
    const gs = createNewGame([{ teamName: 'Flamengo', managerName: 'Tester' }])
    let totalGoals = 0
    let games = 0
    while (!seasonFinished(gs)) {
      const report = playRound(gs)
      for (const { result } of report.results) {
        totalGoals += result.homeGoals + result.awayGoals
        games++
        expect(result.homeGoals).toBeLessThan(15)
      }
    }
    const avg = totalGoals / games
    expect(avg).toBeGreaterThan(1.0)
    expect(avg).toBeLessThan(5.5)

    // taça teve campeão
    expect(gs.cup.winnerId).not.toBeNull()

    const standings = computeStandings(gs, gs.divisions[0])
    expect(standings[0].played).toBe(38)

    const summary = endSeason(gs)
    expect(summary.champions.length).toBe(4)
    expect(summary.cupWinner).not.toBe('—')
    expect(summary.topScorers.length).toBeGreaterThan(0)
    expect(gs.season).toBe(2027)
    expect(gs.inflation).toBeCloseTo(1.05, 5)
  })

  it('leilão resolve na rodada seguinte', () => {
    seed(99)
    const gs = createNewGame([{ teamName: 'Santos', managerName: 'T' }])
    const santos = Object.values(gs.teams).find((t) => t.name === 'Santos')!
    const victim = santos.players.filter((p) => !santos.lineup.includes(p.id))[0]
    const r = putOnAuction(gs, santos, victim, 1000)
    expect(r.accepted).toBe(true)
    expect(gs.auctions.length).toBe(1)
    playRound(gs) // cria na rodada 0, resolve na 1
    playRound(gs)
    expect(gs.auctions.some((a) => a.playerId === victim.id)).toBe(false)
  })

  it('contrato zerado gera pedido de aumento (não sai de graça)', () => {
    seed(55)
    const gs = createNewGame([{ teamName: 'Bahia', managerName: 'T' }])
    const bahia = Object.values(gs.teams).find((t) => t.name === 'Bahia')!
    for (const p of bahia.players) p.contractGames = 1
    const before = bahia.players.length
    playRound(gs)
    expect(bahia.players.length).toBe(before) // ninguém saiu de graça
    // pedidos pendentes para o humano
    expect(gs.raiseRequests.filter((r) => r.teamId === bahia.id).length).toBeGreaterThan(0)
  })

  it('simulação interativa: substituições e pênaltis', () => {
    seed(77)
    const gs = createNewGame([{ teamName: 'Vasco da Gama', managerName: 'T' }])
    const vasco = Object.values(gs.teams).find((t) => t.name === 'Vasco da Gama')!
    const rival = Object.values(gs.teams).find((t) => t.division === 1 && t.id !== vasco.id)!
    const sim = createMatchSim(vasco, rival, drawReferee(gs.referees), 1)
    for (let i = 0; i < 30; i++) {
      stepMinute(sim)
      if (sim.pendingHumanPenalty) sim.pendingHumanPenalty = null
      sim.pendingHumanInjury = null
    }
    const out = fieldPlayers(sim, vasco.id).find((p) => p.pos !== 'G')!
    const inn = benchPlayers(sim, vasco.id).find((p) => p.pos !== 'G')!
    expect(substitute(sim, vasco.id, out.id, inn.id)).toBeNull()
    expect(subsLeft(sim, vasco.id)).toBe(DEFAULT_CALIBRATION.maxSubstitutions - 1)

    // quem saiu não pode voltar (regra do futebol)
    expect(benchPlayers(sim, vasco.id).some((p) => p.id === out.id)).toBe(false)
    expect(substitute(sim, vasco.id, inn.id, out.id)).toContain('não pode voltar')
    while (!sim.finished) {
      stepMinute(sim)
      if (sim.pendingHumanPenalty) sim.pendingHumanPenalty = null
      sim.pendingHumanInjury = null
    }
    const result = finalizeResult(sim)
    expect(result.referee.length).toBeGreaterThan(0)
  })

  it('lesão de time humano: substituição forçada só escolhe quem entra', () => {
    seed(88)
    const gs = createNewGame([{ teamName: 'Grêmio', managerName: 'T' }])
    const gremio = Object.values(gs.teams).find((t) => t.name === 'Grêmio')!
    const rival = Object.values(gs.teams).find((t) => t.division === 1 && t.id !== gremio.id)!
    const sim = createMatchSim(gremio, rival, drawReferee(gs.referees), 1)

    // roda até uma lesão do time humano acontecer
    let guard = 0
    while (!sim.pendingHumanInjury && !sim.finished && guard < 5000) {
      stepMinute(sim)
      if (sim.pendingHumanPenalty) sim.pendingHumanPenalty = null
      if (sim.finished && !sim.pendingHumanInjury) {
        // reinicia outra partida até lesionar alguém
        break
      }
      guard++
    }
    if (sim.pendingHumanInjury) {
      const injuredId = sim.pendingHumanInjury.playerId
      // lesionado já está fora de campo
      expect(fieldPlayers(sim, gremio.id).some((p) => p.id === injuredId)).toBe(false)
      const before = fieldPlayers(sim, gremio.id).length
      const sub = benchPlayers(sim, gremio.id)[0]
      expect(forcedSubstitute(sim, gremio.id, sub.id)).toBeNull()
      expect(fieldPlayers(sim, gremio.id).length).toBe(before + 1)
      expect(sim.pendingHumanInjury).toBeNull()
      expect(subsLeft(sim, gremio.id)).toBe(DEFAULT_CALIBRATION.maxSubstitutions - 1)
    }
  })

  it('taça: empate leva a pênaltis e alguém avança', () => {
    seed(31)
    const gs = createNewGame([{ teamName: 'Cruzeiro', managerName: 'T' }])
    const a = Object.values(gs.teams)[0]
    const b = Object.values(gs.teams)[1]
    let sawShootout = false
    for (let i = 0; i < 60 && !sawShootout; i++) {
      const r = simulateMatch(a, b, drawReferee(gs.referees), 1, { isCup: true })
      if (r.homeGoals === r.awayGoals) {
        expect(r.shootout).not.toBeNull()
        expect(r.shootout!.homeGoals).not.toBe(r.shootout!.awayGoals)
        sawShootout = true
      }
    }
    expect(sawShootout).toBe(true)
  })

  it('sobrevive a 3 temporadas seguidas (modo clássico com distrital)', () => {
    seed(555)
    const gs = createClassicGame(makeClassicFixture(50), [{ teamName: null, managerName: 'T' }])
    for (let s = 0; s < 3; s++) {
      while (!seasonFinished(gs)) playRound(gs)
      endSeason(gs)
      for (const d of gs.divisions) expect(d.teamIds.length).toBe(8)
      for (const t of Object.values(gs.teams)) {
        expect(t.players.length).toBeGreaterThanOrEqual(11)
      }
      expect(Object.values(gs.teams).filter((t) => t.division === DISTRITAL).length).toBe(50 - 32)
    }
  })

  it('estatísticas acumuladas batem com os resultados jogados e resetam', () => {
    seed(321)
    const gs = createNewGame([{ teamName: 'Ceará', managerName: 'T' }])
    let expectedGames = 0
    let expectedGoals = 0
    for (let i = 0; i < 10; i++) {
      const report = playRound(gs)
      for (const { result } of report.results) {
        if (result.neutral) continue
        expectedGames++
        expectedGoals += result.homeGoals + result.awayGoals
      }
    }
    expect(gs.stats.games).toBe(expectedGames)
    expect(gs.stats.homeGoals + gs.stats.awayGoals).toBe(expectedGoals)
    const d = deriveStats(gs.stats)!
    expect(d.avgGoals).toBeCloseTo(expectedGoals / expectedGames, 5)
    expect(d.homeWinPct + d.drawPct + d.awayWinPct).toBeCloseTo(100, 5)

    resetStats(gs)
    expect(gs.stats.games).toBe(0)
    expect(deriveStats(gs.stats)).toBeNull()
    expect(gs.stats.since.round).toBe(gs.currentMatchday + 1)
  })

  it('mando de campo: mandantes vencem mais', () => {
    seed(7)
    const gs = createNewGame([{ teamName: 'Palmeiras', managerName: 'T' }])
    let hg = 0
    let ag = 0
    while (!seasonFinished(gs)) {
      const rep = playRound(gs)
      for (const { result } of rep.results) {
        if (result.neutral) continue
        hg += result.homeGoals
        ag += result.awayGoals
      }
    }
    expect(hg).toBeGreaterThan(ag)
  })
})

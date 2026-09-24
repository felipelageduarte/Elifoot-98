import type { Cup, CupStage, CalendarEntry, GameState } from './types'
import { shuffle } from './rng'

// Taça: eliminatória de jogo único com TODAS as equipes das quatro
// divisões. Final em campo neutro.

function stageName(nTeams: number): string {
  if (nTeams <= 2) return 'FINAL'
  if (nTeams === 4) return 'Meias-finais'
  if (nTeams === 8) return 'Quartos de final'
  if (nTeams === 16) return 'Oitavos de final'
  return `${nTeams / 2} avos de final`
}

function prevPowerOf2(n: number): number {
  let p = 1
  while (p * 2 <= n) p *= 2
  return p
}

// Total de estágios da taça para n equipas (pré-eliminatória incluída)
export function cupStageCount(nTeams: number): number {
  const pow = prevPowerOf2(nTeams)
  const stages = Math.log2(pow)
  return nTeams === pow ? stages : stages + 1
}

// Cria o primeiro estágio (pré-eliminatória se n não for potência de 2)
export function buildCup(teamIds: number[]): Cup {
  const ids = shuffle(teamIds)
  const pow = prevPowerOf2(ids.length)
  const stages: CupStage[] = []

  if (ids.length === pow) {
    const fixtures = []
    for (let i = 0; i < ids.length; i += 2) {
      fixtures.push({ homeId: ids[i], awayId: ids[i + 1], result: null, neutral: ids.length === 2 })
    }
    stages.push({ name: stageName(ids.length), fixtures, byeTeamIds: [] })
  } else {
    // 2k equipas jogam a pré-eliminatória; as restantes ficam isentas
    const k = ids.length - pow
    const playing = ids.slice(0, 2 * k)
    const byes = ids.slice(2 * k)
    const fixtures = []
    for (let i = 0; i < playing.length; i += 2) {
      fixtures.push({ homeId: playing[i], awayId: playing[i + 1], result: null })
    }
    stages.push({ name: 'Pré-eliminatória', fixtures, byeTeamIds: byes })
  }

  return { stages, eliminated: [], winnerId: null }
}

// Chamado quando um estágio termina: gera o próximo (ou define o campeão)
export function advanceCup(cup: Cup): void {
  const last = cup.stages[cup.stages.length - 1]
  const winners: number[] = []
  for (const f of last.fixtures) {
    if (!f.result) continue
    let winnerId: number
    if (f.result.homeGoals > f.result.awayGoals) winnerId = f.homeId
    else if (f.result.homeGoals < f.result.awayGoals) winnerId = f.awayId
    else {
      // desempate por penáltis
      const s = f.result.shootout
      winnerId = s && s.homeGoals > s.awayGoals ? f.homeId : f.awayId
    }
    winners.push(winnerId)
    cup.eliminated.push(winnerId === f.homeId ? f.awayId : f.homeId)
  }
  const survivors = shuffle([...winners, ...last.byeTeamIds])

  if (survivors.length === 1) {
    cup.winnerId = survivors[0]
    return
  }

  const fixtures = []
  for (let i = 0; i < survivors.length; i += 2) {
    fixtures.push({
      homeId: survivors[i],
      awayId: survivors[i + 1],
      result: null,
      neutral: survivors.length === 2, // FINAL em campo neutro
    })
  }
  cup.stages.push({ name: stageName(survivors.length), fixtures, byeTeamIds: [] })
}

// Calendário da época: taça intercalada a cada 3 jornadas de liga;
// estágios restantes (e a final) após a última jornada.
export function buildCalendar(leagueRounds: number, nCupStages: number): CalendarEntry[] {
  const calendar: CalendarEntry[] = []
  let cupIdx = 0
  for (let league = 0; league < leagueRounds; league++) {
    calendar.push({ type: 'league', index: league })
    if ((league + 1) % 3 === 0 && cupIdx < nCupStages - 1) {
      calendar.push({ type: 'cup', index: cupIdx++ })
    }
  }
  while (cupIdx < nCupStages) {
    calendar.push({ type: 'cup', index: cupIdx++ })
  }
  return calendar
}

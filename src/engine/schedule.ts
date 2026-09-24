import type { Round } from './types'
import { shuffle } from './rng'

// Round-robin duplo (turno e returno) pelo método do círculo
export function buildRounds(teamIds: number[]): Round[] {
  const ids = shuffle(teamIds)
  const n = ids.length
  const half = n / 2
  const arr = ids.slice()
  const firstLeg: Round[] = []

  for (let r = 0; r < n - 1; r++) {
    const fixtures = []
    for (let i = 0; i < half; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      // alterna mando para distribuir casa/fora
      const home = r % 2 === 0 ? a : b
      const away = r % 2 === 0 ? b : a
      fixtures.push({ homeId: home, awayId: away, result: null })
    }
    firstLeg.push({ fixtures })
    // rotação (fixa o primeiro)
    arr.splice(1, 0, arr.pop()!)
  }

  const secondLeg: Round[] = firstLeg.map((round) => ({
    fixtures: round.fixtures.map((f) => ({ homeId: f.awayId, awayId: f.homeId, result: null })),
  }))

  return [...firstLeg, ...secondLeg]
}

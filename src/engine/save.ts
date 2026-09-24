import type { GameState } from './types'
import { setNextPlayerId } from './newgame'
import { makeEmptyStats } from './stats'

const KEY = 'elifoot-web-save'

export function saveGame(state: GameState, slot = 1) {
  localStorage.setItem(`${KEY}-${slot}`, JSON.stringify(state))
}

function migrate(state: GameState): GameState | null {
  // saves da versão 1 (antes da taça/leilão/moral) não são compatíveis
  if (!state.version || state.version < 2) return null
  for (const team of Object.values(state.teams)) {
    if (!team.ledger) team.ledger = []
    if (!team.seasonHistory) team.seasonHistory = []
  }
  if (!state.stats) state.stats = makeEmptyStats(state.season, state.currentMatchday + 1)
  return state
}

export function loadGame(slot = 1): GameState | null {
  const raw = localStorage.getItem(`${KEY}-${slot}`)
  if (!raw) return null
  try {
    const state = JSON.parse(raw) as GameState
    setNextPlayerId(state.nextPlayerId)
    return migrate(state)
  } catch {
    return null
  }
}

export function hasSave(slot = 1): boolean {
  return localStorage.getItem(`${KEY}-${slot}`) !== null
}

export function deleteSave(slot = 1) {
  localStorage.removeItem(`${KEY}-${slot}`)
}

export function exportSave(state: GameState): string {
  return JSON.stringify(state, null, 2)
}

export function importSave(json: string): GameState | null {
  try {
    const state = JSON.parse(json) as GameState
    if (!state.teams || !state.divisions) return null
    setNextPlayerId(state.nextPlayerId)
    return migrate(state)
  } catch {
    return null
  }
}

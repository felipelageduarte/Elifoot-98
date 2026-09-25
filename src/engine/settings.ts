import type { Calibration } from './calibration'
import { DEFAULT_CALIBRATION } from './calibration'

export type Theme = 'retro' | 'modern' | 'ultra'
// Velocidades da partida: Lento, Médio, Rápido, Super-rápido,
// Rapidíssimo, Ultrassónico
export type MatchSpeed = 'lento' | 'normal' | 'rapido' | 'superrapido' | 'rapidissimo' | 'ultrassonico'

export interface Settings {
  theme: Theme
  matchSpeed: MatchSpeed
  sound: boolean
  confirmations: boolean
  showShortcutHints: boolean
  calibration: Calibration
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'ultra',
  matchSpeed: 'normal',
  sound: true,
  confirmations: true,
  showShortcutHints: true,
  calibration: { ...DEFAULT_CALIBRATION },
}

export const SPEED_MS: Record<MatchSpeed, number> = {
  lento: 600,
  normal: 300,
  rapido: 150,
  superrapido: 60,
  rapidissimo: 20,
  ultrassonico: 0,
}

export const SPEED_LABELS: Record<MatchSpeed, string> = {
  lento: '🐢 Lento',
  normal: '▶ Médio',
  rapido: '⏩ Rápido',
  superrapido: '🚀 Super-rápido',
  rapidissimo: '⚡ Rapidíssimo',
  ultrassonico: '🛸 Ultrassónico',
}

const KEY = 'elifoot-web-settings'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, calibration: { ...DEFAULT_CALIBRATION } }
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      calibration: { ...DEFAULT_CALIBRATION, ...(parsed.calibration ?? {}) },
    }
  } catch {
    return { ...DEFAULT_SETTINGS, calibration: { ...DEFAULT_CALIBRATION } }
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // armazenamento indisponível: ignora
  }
}

// RNG determinístico (mulberry32) — permite reprodutibilidade de partidas se necessário

let state = Date.now() >>> 0

export function seed(s: number) {
  state = s >>> 0
}

export function rand(): number {
  state |= 0
  state = (state + 0x6d2b79f5) | 0
  let t = Math.imul(state ^ (state >>> 15), 1 | state)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Random(n) do Pascal: inteiro uniforme em [0, n)
export function random(n: number): number {
  return Math.floor(rand() * n)
}

export function randInt(min: number, max: number): number {
  return min + random(max - min + 1)
}

export function pick<T>(arr: T[]): T {
  return arr[random(arr.length)]
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = random(i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

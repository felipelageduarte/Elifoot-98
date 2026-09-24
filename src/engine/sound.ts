// Sons sintetizados via Web Audio API — sem arquivos externos.
// Habilitados/desabilitados nas configurações.

let enabled = true
let ctx: AudioContext | null = null

export function setSoundEnabled(on: boolean) {
  enabled = on
}

function ac(): AudioContext | null {
  if (!enabled) return null
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

function tone(
  freq: number,
  start: number,
  duration: number,
  type: OscillatorType = 'square',
  gain = 0.08,
  freqEnd?: number,
) {
  const a = ac()
  if (!a) return
  const osc = a.createOscillator()
  const g = a.createGain()
  osc.type = type
  const t0 = a.currentTime + start
  osc.frequency.setValueAtTime(freq, t0)
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration)
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  osc.connect(g)
  g.connect(a.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.02)
}

function noise(start: number, duration: number, gain = 0.12, lowpass = 1200) {
  const a = ac()
  if (!a) return
  const bufferSize = Math.floor(a.sampleRate * duration)
  const buffer = a.createBuffer(1, bufferSize, a.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buffer
  const filter = a.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.value = lowpass
  const g = a.createGain()
  const t0 = a.currentTime + start
  g.gain.setValueAtTime(gain, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration)
  src.connect(filter)
  filter.connect(g)
  g.connect(a.destination)
  src.start(t0)
}

// apito: início/intervalo/fim de jogo
export function playWhistle(long = false) {
  if (long) {
    tone(2350, 0, 0.35, 'square', 0.06)
    tone(2350, 0.45, 0.35, 'square', 0.06)
    tone(2350, 0.9, 0.6, 'square', 0.06)
  } else {
    tone(2350, 0, 0.45, 'square', 0.06)
  }
}

// gol: torcida (ruído) + fanfarra ascendente
export function playGoal() {
  noise(0, 1.4, 0.14, 900)
  tone(523, 0, 0.12, 'sawtooth', 0.07)
  tone(659, 0.12, 0.12, 'sawtooth', 0.07)
  tone(784, 0.24, 0.12, 'sawtooth', 0.07)
  tone(1047, 0.36, 0.35, 'sawtooth', 0.08)
}

// gol sofrido: lamento descendente
export function playGoalAgainst() {
  noise(0, 0.8, 0.06, 500)
  tone(400, 0, 0.5, 'sawtooth', 0.06, 180)
}

export function playCard() {
  tone(220, 0, 0.18, 'square', 0.08)
  tone(180, 0.2, 0.25, 'square', 0.08)
}

export function playSub() {
  tone(880, 0, 0.1, 'triangle', 0.08)
  tone(660, 0.12, 0.15, 'triangle', 0.08)
}

export function playInjury() {
  tone(300, 0, 0.3, 'sine', 0.08, 200)
}

export function playPost() {
  tone(1200, 0, 0.08, 'square', 0.09)
  tone(900, 0.08, 0.2, 'square', 0.05)
}

export function playClick() {
  tone(1000, 0, 0.04, 'square', 0.04)
}

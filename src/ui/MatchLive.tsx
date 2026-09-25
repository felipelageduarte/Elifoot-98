import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameState, MatchEvent, MatchResult, Player } from '../engine/types'
import { playerDisplayName } from '../engine/types'
import type { PendingHumanMatch } from '../engine/season'
import {
  createMatchSim, stepMinute, finalizeResult, substitute, forcedSubstitute, fieldPlayers, benchPlayers, subsLeft,
  takePenalty, aiPenaltyTaker,
} from '../engine/match'
import { drawReferee } from '../engine/referees'
import { SPEED_MS, SPEED_LABELS } from '../engine/settings'
import type { MatchSpeed } from '../engine/settings'
import {
  playGoal, playGoalAgainst, playCard, playSub, playInjury, playPost, playWhistle,
} from '../engine/sound'
import { TeamChip, useSettings } from './common'

const SPEED_ORDER: MatchSpeed[] = ['lento', 'normal', 'rapido', 'superrapido', 'rapidissimo', 'ultrassonico']

export function MatchLive({
  state,
  match,
  onFinished,
}: {
  state: GameState
  match: PendingHumanMatch
  onFinished: (result: MatchResult) => void
}) {
  const { settings } = useSettings()
  const home = state.teams[match.homeId]
  const away = state.teams[match.awayId]

  const sim = useMemo(
    () => createMatchSim(home, away, drawReferee(state.referees), state.inflation, { neutral: match.neutral, isCup: match.isCup }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [match.homeId, match.awayId],
  )

  const [minute, setMinute] = useState(0)
  const [running, setRunning] = useState(true)
  const [speed, setSpeed] = useState<MatchSpeed>(settings.matchSpeed)
  const [showSubs, setShowSubs] = useState(false)
  const [subMsg, setSubMsg] = useState('')
  const [halfPause, setHalfPause] = useState(false)
  const [penaltyTeamId, setPenaltyTeamId] = useState<number | null>(null)
  const [injurySub, setInjurySub] = useState<{ teamId: number; injuredName: string; injuredPos: string } | null>(null)
  const tickerRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  const humanTeams = [home, away].filter((t) => t.isHuman)
  const [subTeamId, setSubTeamId] = useState(humanTeams[0]?.id ?? home.id)
  const [outId, setOutId] = useState(0)
  const [inId, setInId] = useState(0)

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true
      if (settings.sound) playWhistle()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const paused = showSubs || penaltyTeamId !== null || injurySub !== null

  useEffect(() => {
    if (!running || sim.finished || paused) return
    const id = setInterval(() => {
      const events = stepMinute(sim)
      setMinute(sim.minute)
      handleEventSounds(events)
      if (sim.pendingHumanPenalty) {
        setRunning(false)
        setPenaltyTeamId(sim.pendingHumanPenalty.teamId)
        return
      }
      if (sim.minute === 45) {
        setRunning(false)
        setHalfPause(true)
        setShowSubs(true)
      }
      if (sim.pendingHumanInjury) {
        setRunning(false)
        const injTeam = state.teams[sim.pendingHumanInjury.teamId]
        const injured = injTeam?.players.find((p) => p.id === sim.pendingHumanInjury!.playerId)
        setInjurySub({
          teamId: sim.pendingHumanInjury.teamId,
          injuredName: injured ? injured.name : 'O jogador',
          injuredPos: injured ? injured.pos : '',
        })
      }
      if (sim.finished) setRunning(false)
    }, SPEED_MS[speed])
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, speed, paused, sim])

  const handleEventSounds = (events: MatchEvent[]) => {
    if (!settings.sound) return
    for (const e of events) {
      switch (e.type) {
        case 'goal':
        case 'pen_goal': {
          const scorerHuman = e.teamId !== null && state.teams[e.teamId]?.isHuman
          if (scorerHuman || humanTeams.length === 0) playGoal()
          else playGoalAgainst()
          break
        }
        case 'yellow':
        case 'red':
          playCard()
          break
        case 'sub':
          playSub()
          break
        case 'injury':
          playInjury()
          break
        case 'post':
        case 'bar':
        case 'pen_miss':
          playPost()
          break
        case 'half':
          playWhistle()
          break
        case 'end':
          playWhistle(true)
          break
      }
    }
  }

  useEffect(() => {
    tickerRef.current?.scrollTo({ top: tickerRef.current.scrollHeight })
  }, [minute, showSubs, penaltyTeamId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === ' ') {
        e.preventDefault()
        if (sim.finished) onFinished(finalizeResult(sim))
        else if (!paused) setRunning((r) => !r)
      } else if (e.key === 'Enter' && sim.finished) {
        onFinished(finalizeResult(sim))
      } else if ('123456'.includes(e.key) && e.key !== '') {
        const idx = Number(e.key) - 1
        if (SPEED_ORDER[idx]) setSpeed(SPEED_ORDER[idx])
      } else if (e.key.toLowerCase() === 's' && humanTeams.length > 0 && !sim.finished && penaltyTeamId === null && injurySub === null) {
        setRunning(false)
        setShowSubs(true)
      } else if (e.key === 'Escape' && showSubs) {
        closeSubs()
      } else if (e.key.toLowerCase() === 'f' && !sim.finished && penaltyTeamId === null && injurySub === null) {
        skipToEnd()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSubs, penaltyTeamId, injurySub, sim, humanTeams.length, paused])

  const skipToEnd = () => {
    setShowSubs(false)
    setHalfPause(false)
    setInjurySub(null)
    while (!sim.finished) {
      const events = stepMinute(sim)
      if (sim.pendingHumanPenalty) {
        const side = sim.home.team.id === sim.pendingHumanPenalty.teamId ? sim.home : sim.away
        sim.pendingHumanPenalty = null
        takePenalty(sim, side, aiPenaltyTaker(side))
      }
      sim.pendingHumanInjury = null
      if (sim.finished && settings.sound) handleEventSounds(events.filter((e) => e.type === 'end'))
    }
    setMinute(sim.minute)
    setRunning(false)
  }

  const closeSubs = () => {
    sim.pendingHumanInjury = null
    setShowSubs(false)
    setSubMsg('')
    setHalfPause(false)
    if (!sim.finished) setRunning(true)
  }

  const doSub = () => {
    if (!outId || !inId) {
      setSubMsg('Escolha quem sai e quem entra.')
      return
    }
    const err = substitute(sim, subTeamId, outId, inId)
    if (err) setSubMsg(err)
    else {
      if (settings.sound) playSub()
      setSubMsg('Substituição feita!')
      setOutId(0)
      setInId(0)
      setMinute((m) => m)
    }
  }

  const shootPenalty = (taker: Player) => {
    if (penaltyTeamId === null) return
    sim.pendingHumanPenalty = null
    const scored = takePenalty(sim, penaltyTeamId, taker)
    if (settings.sound) (scored ? playGoal : playPost)()
    setPenaltyTeamId(null)
    setMinute(sim.minute)
    if (!sim.finished && sim.minute < 90) setRunning(true)
    else if (sim.minute >= 90 && !sim.finished) {
      // deixa o próximo tick fechar a partida (ou shootout da taça)
      setRunning(true)
    }
  }

  const homeGoals = sim.home.goals
  const awayGoals = sim.away.goals

  const eventClass = (t: string) =>
    t === 'goal' || t === 'pen_goal' ? 'goal'
      : t === 'yellow' ? 'card-yellow'
        : t === 'red' || t === 'pen_miss' ? 'card-red'
          : t === 'injury' || t === 'sub' ? 'injury' : ''

  return (
    <div className="col">
      <div className="scoreboard">
        <span>
          <TeamChip colors={home.colors} /> {home.name}
          {home.isHuman ? ' 👤' : ''}
        </span>
        <span>
          <span className="score-num" key={`h${homeGoals}`}>{homeGoals}</span>
          {' x '}
          <span className="score-num" key={`a${awayGoals}`}>{awayGoals}</span>
        </span>
        <span>
          {away.name}
          {away.isHuman ? ' 👤' : ''} <TeamChip colors={away.colors} />
        </span>
        <span className="clock">{Math.min(minute, 90)}'</span>
      </div>
      <div className="row" style={{ fontSize: 12, justifyContent: 'center' }}>
        <span>
          {match.isCup ? '🏆 TAÇA' : '⚽ Campeonato'}
          {match.neutral ? ' — CAMPO NEUTRO' : ''} · Árbitro: {sim.referee.name}
        </span>
      </div>

      <div className="match-ticker" ref={tickerRef}>
        {sim.events.map((e, i) => (
          <div key={i} className={eventClass(e.type)}>
            {e.minute > 0 ? `${e.minute}' ` : ''}
            {e.text}
          </div>
        ))}
        {sim.finished && (
          <div style={{ color: '#88ccff' }}>
            Público: {sim.attendance.toLocaleString('pt-BR')} — Renda: ${sim.gate.toLocaleString('pt-BR')}
            {sim.neutral ? ' (dividida entre os clubes)' : ' (fica com o mandante)'}
          </div>
        )}
      </div>

      <div className="row">
        {!sim.finished && (
          <>
            <button onClick={() => setRunning((r) => !r)} className="primary" disabled={paused}>
              {running ? '⏸ Pausar (espaço)' : '▶ Continuar (espaço)'}
            </button>
            {SPEED_ORDER.map((s, i) => (
              <button key={s} onClick={() => setSpeed(s)} className={speed === s ? 'primary' : ''} title={`Tecla ${i + 1}`}>
                {SPEED_LABELS[s]}
              </button>
            ))}
            {humanTeams.length > 0 && (
              <button onClick={() => { setRunning(false); setShowSubs(true) }} disabled={penaltyTeamId !== null}>
                🔁 Substituições (S)
              </button>
            )}
            <button onClick={skipToEnd} disabled={penaltyTeamId !== null}>⏭ Pular para o fim (F)</button>
          </>
        )}
        {sim.finished && (
          <button className="primary" autoFocus onClick={() => onFinished(finalizeResult(sim))}>
            Continuar ▶ (Enter)
          </button>
        )}
      </div>

      {injurySub && (
        <div className="panel inset-gray">
          <h3>🚑 Lesão — {state.teams[injurySub.teamId].name}</h3>
          <p style={{ margin: '4px 0' }}>
            <b>{injurySub.injuredName}</b> ({injurySub.injuredPos}) lesionou-se e tem de ser substituído.
            Escolha o jogador a entrar (destacado: mesma posição):
          </p>
          <div className="row">
            {benchPlayers(sim, injurySub.teamId).map((p) => (
              <button
                key={p.id}
                className={p.pos === injurySub.injuredPos ? 'primary' : ''}
                onClick={() => {
                  const err = forcedSubstitute(sim, injurySub.teamId, p.id)
                  if (err) {
                    setSubMsg(err)
                    return
                  }
                  if (settings.sound) playSub()
                  setInjurySub(null)
                  setMinute(sim.minute)
                  if (!sim.finished) setRunning(true)
                }}
              >
                {p.pos} {playerDisplayName(p)} (⭐{p.strength})
              </button>
            ))}
            <button
              onClick={() => {
                sim.pendingHumanInjury = null
                setInjurySub(null)
                if (!sim.finished) setRunning(true)
              }}
            >
              Jogar com um a menos
            </button>
          </div>
          <p style={{ fontSize: 11, margin: '4px 0 0' }}>
            Restam {subsLeft(sim, injurySub.teamId)} substituições.
          </p>
        </div>
      )}

      {penaltyTeamId !== null && (
        <div className="panel inset-gray">
          <h3>⚠️ P E N A L T I — {state.teams[penaltyTeamId].name}, escolha o cobrador!</h3>
          <div className="row">
            {fieldPlayers(sim, penaltyTeamId)
              .slice()
              .sort((a, b) => b.strength - a.strength)
              .map((p) => (
                <button key={p.id} onClick={() => shootPenalty(p)}>
                  {p.pos} {playerDisplayName(p)} (⭐{p.strength})
                </button>
              ))}
          </div>
        </div>
      )}

      {showSubs && humanTeams.length > 0 && penaltyTeamId === null && (
        <div className="panel inset-gray">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>🔁 Substituições {halfPause && '— Intervalo'}</h3>
            <button
              className="primary"
              autoFocus
              style={{ fontSize: 16, padding: '10px 26px' }}
              onClick={closeSubs}
            >
              {halfPause ? '▶ COMEÇAR O 2º TEMPO' : '▶ VOLTAR AO JOGO'} (Esc)
            </button>
          </div>
          <div className="row" style={{ margin: '6px 0' }}>
            {humanTeams.length > 1 && (
              <select value={subTeamId} onChange={(e) => { setSubTeamId(Number(e.target.value)); setOutId(0); setInId(0) }}>
                {humanTeams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            )}
            <span>
              Restam <b>{subsLeft(sim, subTeamId)}</b> substituições · goleiro só sai por goleiro
            </span>
          </div>
          <div className="row sub-cols" style={{ alignItems: 'stretch' }}>
            <div className="grow">
              <b>Em campo ({fieldPlayers(sim, subTeamId).length})</b>
              <div className="sub-list">
                {fieldPlayers(sim, subTeamId)
                  .slice()
                  .sort((a, b) => 'GDMA'.indexOf(a.pos) - 'GDMA'.indexOf(b.pos) || b.strength - a.strength)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`sub-item${outId === p.id ? ' sel' : ''}`}
                      onClick={() => setOutId(outId === p.id ? 0 : p.id)}
                    >
                      <span><span className={`pos-${p.pos}`}>{p.pos}</span> {playerDisplayName(p)}</span>
                      <span>⭐{p.strength}</span>
                    </div>
                  ))}
              </div>
            </div>
            <div className="sub-cols-action" style={{ alignSelf: 'center', textAlign: 'center', minWidth: 130 }}>
              <button
                className="primary"
                style={{ fontSize: 15, padding: '12px 18px' }}
                disabled={!outId || !inId || subsLeft(sim, subTeamId) <= 0}
                onClick={doSub}
              >
                Substituir ⇄
              </button>
              {subMsg && <p style={{ margin: '6px 0 0', fontSize: 12 }}>{subMsg}</p>}
            </div>
            <div className="grow">
              <b>Banco ({benchPlayers(sim, subTeamId).length})</b>
              <div className="sub-list">
                {benchPlayers(sim, subTeamId)
                  .slice()
                  .sort((a, b) => 'GDMA'.indexOf(a.pos) - 'GDMA'.indexOf(b.pos) || b.strength - a.strength)
                  .map((p) => (
                    <div
                      key={p.id}
                      className={`sub-item${inId === p.id ? ' sel' : ''}`}
                      onClick={() => setInId(inId === p.id ? 0 : p.id)}
                    >
                      <span><span className={`pos-${p.pos}`}>{p.pos}</span> {playerDisplayName(p)}</span>
                      <span>⭐{p.strength}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { useState } from 'react'
import type { GameState } from '../engine/types'
import { entryLabel } from '../engine/season'
import { TeamLink, TeamRosterDialog } from './common'

type Tab = 'league' | 'cup' | 'calendar'

export function Fixtures({ state, activeTeamId }: { state: GameState; activeTeamId: number }) {
  const [tab, setTab] = useState<Tab>('league')
  const activeDiv = state.teams[activeTeamId].division
  const [divLevel, setDivLevel] = useState(activeDiv <= 4 ? activeDiv : 1)
  const [viewTeamId, setViewTeamId] = useState<number | null>(null)
  const division = state.divisions.find((d) => d.level === divLevel)!
  const [roundIdx, setRoundIdx] = useState(0)
  const round = division.rounds[Math.min(roundIdx, division.rounds.length - 1)]

  return (
    <div className="col">
      <div className="row">
        <button className={tab === 'league' ? 'primary' : ''} onClick={() => setTab('league')}>⚽ Campeonato</button>
        <button className={tab === 'cup' ? 'primary' : ''} onClick={() => setTab('cup')}>🏆 Taça</button>
        <button className={tab === 'calendar' ? 'primary' : ''} onClick={() => setTab('calendar')}>📅 Calendário</button>
      </div>

      {tab === 'league' && (
        <>
          <div className="row">
            {state.divisions.map((d) => (
              <button key={d.level} className={d.level === divLevel ? 'primary' : ''} onClick={() => setDivLevel(d.level)}>
                {d.name}
              </button>
            ))}
          </div>
          <div className="row">
            <button onClick={() => setRoundIdx(Math.max(0, roundIdx - 1))}>◀</button>
            <b>Rodada {Math.min(roundIdx, division.rounds.length - 1) + 1} de {division.rounds.length}</b>
            <button onClick={() => setRoundIdx(Math.min(division.rounds.length - 1, roundIdx + 1))}>▶</button>
          </div>
          <div className="panel">
            <table className="grid">
              <tbody>
                {round?.fixtures.map((f, i) => {
                  const home = state.teams[f.homeId]
                  const away = state.teams[f.awayId]
                  const mine = f.homeId === activeTeamId || f.awayId === activeTeamId
                  return (
                    <tr key={i} className={mine ? 'row-mine' : ''}>
                      <td style={{ textAlign: 'right', width: '38%' }}>
                        {home.isHuman && '👤 '}
                        <TeamLink state={state} teamId={home.id} onOpen={setViewTeamId} />
                      </td>
                      <td style={{ textAlign: 'center', width: 90 }}>
                        {f.result ? <b>{f.result.homeGoals} x {f.result.awayGoals}</b> : 'x'}
                      </td>
                      <td style={{ width: '38%' }}>
                        <TeamLink state={state} teamId={away.id} onOpen={setViewTeamId} />
                        {away.isHuman && ' 👤'}
                      </td>
                      <td style={{ fontSize: 11 }}>
                        {f.result ? `Público: ${f.result.attendance.toLocaleString('pt-BR')}` : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'cup' && (
        <div className="col">
          {state.cup.winnerId !== null && (
            <div className="panel inset-gray">
              <h3>🏆 VENCEDOR DA TAÇA: {state.teams[state.cup.winnerId].name}</h3>
            </div>
          )}
          {state.cup.stages.slice().reverse().map((stage, idx) => (
            <div className="panel" key={idx}>
              <b>{stage.name}</b>
              {stage.byeTeamIds.length > 0 && (
                <p style={{ fontSize: 11, margin: 2 }}>
                  Isentos: {stage.byeTeamIds.map((id) => state.teams[id].name).join(', ')}
                </p>
              )}
              <table className="grid">
                <tbody>
                  {stage.fixtures.map((f, i) => {
                    const home = state.teams[f.homeId]
                    const away = state.teams[f.awayId]
                    const mine = f.homeId === activeTeamId || f.awayId === activeTeamId
                    const so = f.result?.shootout
                    return (
                      <tr key={i} className={mine ? 'row-mine' : ''}>
                        <td style={{ textAlign: 'right', width: '38%' }}>
                          <TeamLink state={state} teamId={home.id} onOpen={setViewTeamId} />
                        </td>
                        <td style={{ textAlign: 'center', width: 120 }}>
                          {f.result ? (
                            <b>
                              {f.result.homeGoals} x {f.result.awayGoals}
                              {so && <span style={{ fontSize: 10 }}> ({so.homeGoals}-{so.awayGoals} pen.)</span>}
                            </b>
                          ) : f.neutral ? 'CAMPO NEUTRO' : 'x'}
                        </td>
                        <td style={{ width: '38%' }}>
                          <TeamLink state={state} teamId={away.id} onOpen={setViewTeamId} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="panel">
          <table className="grid">
            <thead>
              <tr><th>#</th><th>Jornada</th><th>Status</th></tr>
            </thead>
            <tbody>
              {state.calendar.map((entry, i) => (
                <tr key={i} className={i === state.currentMatchday ? 'row-mine' : ''} style={i === state.currentMatchday ? { fontWeight: 'bold' } : undefined}>
                  <td>{i + 1}</td>
                  <td>{entryLabel(state, entry)}</td>
                  <td>{i < state.currentMatchday ? '✅ jogada' : i === state.currentMatchday ? '▶ PRÓXIMA' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {viewTeamId !== null && (
        <TeamRosterDialog state={state} teamId={viewTeamId} onClose={() => setViewTeamId(null)} />
      )}
    </div>
  )
}

import { useState } from 'react'
import type { GameState } from '../engine/types'
import { computeStandings } from '../engine/season'
import { TeamLink, TeamRosterDialog } from './common'

export function TablePage({ state, activeTeamId }: { state: GameState; activeTeamId: number }) {
  const activeDiv = state.teams[activeTeamId].division
  const [divLevel, setDivLevel] = useState(activeDiv)
  const [viewTeamId, setViewTeamId] = useState<number | null>(null)
  const division = state.divisions.find((d) => d.level === divLevel)!
  const standings = computeStandings(state, division)
  const promoted = 4

  return (
    <div className="col">
      <div className="row">
        {state.divisions.map((d) => (
          <button key={d.level} className={d.level === divLevel ? 'primary' : ''} onClick={() => setDivLevel(d.level)}>
            {d.name}
          </button>
        ))}
      </div>
      <div className="panel">
        <table className="grid">
          <thead>
            <tr>
              <th>#</th>
              <th>Clube</th>
              <th>P</th>
              <th>J</th>
              <th>V</th>
              <th>E</th>
              <th>D</th>
              <th>GP</th>
              <th>GC</th>
              <th>SG</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((s, idx) => {
              const team = state.teams[s.teamId]
              const zone =
                divLevel > 1 && idx < promoted
                  ? 'zone-promotion'
                  : divLevel < state.divisions.length && idx >= standings.length - promoted
                    ? 'zone-relegation'
                    : ''
              return (
                <tr key={s.teamId} className={s.teamId === activeTeamId ? 'selected' : ''}>
                  <td className={zone}>{idx + 1}º</td>
                  <td className={zone}>
                    <TeamLink state={state} teamId={team.id} onOpen={setViewTeamId} />
                    {team.isHuman && ` 👤 ${team.managerName}`}
                  </td>
                  <td className={zone}><b>{s.points}</b></td>
                  <td className={zone}>{s.played}</td>
                  <td className={zone}>{s.wins}</td>
                  <td className={zone}>{s.draws}</td>
                  <td className={zone}>{s.losses}</td>
                  <td className={zone}>{s.goalsFor}</td>
                  <td className={zone}>{s.goalsAgainst}</td>
                  <td className={zone}>{s.goalsFor - s.goalsAgainst}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ fontSize: 12 }}>
        <span>🟩 Zona de acesso</span>
        <span>🟥 Zona de rebaixamento</span>
        <span>(4 sobem, 4 descem)</span>
      </div>
      {viewTeamId !== null && (
        <TeamRosterDialog state={state} teamId={viewTeamId} onClose={() => setViewTeamId(null)} />
      )}
    </div>
  )
}

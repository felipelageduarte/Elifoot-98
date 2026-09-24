import type { GameState, MatchResult } from '../engine/types'
import type { RoundReport } from '../engine/season'

export function RoundResults({
  state,
  report,
  activeTeamId,
  label,
  onDone,
}: {
  state: GameState
  report: RoundReport
  activeTeamId: number
  label: string
  onDone: () => void
}) {
  const byCompetition = new Map<string, MatchResult[]>()
  for (const { competition, result } of report.results) {
    if (!byCompetition.has(competition)) byCompetition.set(competition, [])
    byCompetition.get(competition)!.push(result)
  }

  return (
    <div className="col">
      <h3>📋 Resultados — {label}</h3>
      {report.auctionMessages.length > 0 && (
        <div className="panel inset-gray">
          <b>🔨 Leilões resolvidos:</b>
          {report.auctionMessages.map((m, i) => (
            <div key={i} className="news-item">{m}</div>
          ))}
        </div>
      )}
      {report.news.length > 0 && (
        <div className="panel inset-gray">
          {report.news.map((n, i) => (
            <div key={i} className="news-item">{n}</div>
          ))}
        </div>
      )}
      {[...byCompetition.entries()].map(([comp, results]) => (
        <div className="panel" key={comp}>
          <b>{comp}</b>
          <table className="grid">
            <tbody>
              {results.map((r, i) => {
                const mine = r.homeId === activeTeamId || r.awayId === activeTeamId
                return (
                  <tr key={i} className={mine ? 'row-mine' : ''}>
                    <td style={{ textAlign: 'right', width: '40%' }}>{state.teams[r.homeId].name}</td>
                    <td style={{ textAlign: 'center', width: 110 }}>
                      <b>
                        {r.homeGoals} x {r.awayGoals}
                        {r.shootout && <span style={{ fontSize: 10 }}> ({r.shootout.homeGoals}-{r.shootout.awayGoals} pen.)</span>}
                      </b>
                    </td>
                    <td>{state.teams[r.awayId].name}</td>
                    <td style={{ fontSize: 11 }}>Público: {r.attendance.toLocaleString('pt-BR')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ))}
      <div className="row">
        <button className="primary" autoFocus onClick={onDone}>
          Continuar ▶ (Enter)
        </button>
      </div>
    </div>
  )
}

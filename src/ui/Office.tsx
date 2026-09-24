import type { GameState, Team } from '../engine/types'
import { DISTRITAL } from '../engine/types'
import { computeStandings, positionOf, currentEntry, entryLabel, managerOf } from '../engine/season'
import { weeklyWages, loanInterest } from '../engine/finance'
import { Money, TeamChip } from './common'

export function Office({
  state,
  team,
  onPlayRound,
  seasonOver,
}: {
  state: GameState
  team: Team
  onPlayRound: () => void
  seasonOver: boolean
}) {
  const division = state.divisions.find((d) => d.level === team.division)
  const standings = division ? computeStandings(state, division) : []
  const pos = division ? positionOf(standings, team.id) : 0
  const entry = currentEntry(state)
  const manager = managerOf(state, team.id)

  // adversário na jornada atual (liga ou taça)
  let opponent: Team | null = null
  let isHome = false
  let competitionLabel = ''
  if (entry) {
    competitionLabel = entryLabel(state, entry)
    if (entry.type === 'league' && division) {
      const round = division.rounds[entry.index]
      const fixture = round?.fixtures.find((f) => f.homeId === team.id || f.awayId === team.id)
      if (fixture) {
        opponent = state.teams[fixture.homeId === team.id ? fixture.awayId : fixture.homeId]
        isHome = fixture.homeId === team.id
      }
    } else if (entry.type === 'cup') {
      const stage = state.cup.stages[entry.index]
      const fixture = stage?.fixtures.find((f) => f.homeId === team.id || f.awayId === team.id)
      if (fixture) {
        opponent = state.teams[fixture.homeId === team.id ? fixture.awayId : fixture.homeId]
        isHome = fixture.homeId === team.id
      }
    }
  }

  const startersOk = team.lineup
    .map((id) => team.players.find((p) => p.id === id))
    .filter((p) => p && p.suspendedGames === 0 && p.injuredGames === 0).length

  const pendingRaises = state.raiseRequests.filter((r) => r.teamId === team.id).length
  const myAuctions = state.auctions.filter((a) => a.sellerTeamId === team.id).length

  return (
    <div className="col">
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="panel grow">
          <h3>
            <TeamChip colors={team.colors} /> {team.name} —{' '}
            {team.division === DISTRITAL ? 'Distrital' : division?.name}
          </h3>
          <p>Técnico: <b>{team.managerName}</b>{manager?.onVacation && ' (de férias)'}</p>
          {division && <p>Posição: <b>{pos}º</b> de {division.teamIds.length} — Temporada {state.season} (época {state.seasonNumber})</p>}
          <p>Caixa: <Money value={team.cash} /> · Folha/jogo: <Money value={-weeklyWages(team)} /></p>
          <p>
            Moral: <b>{team.moral}/20</b>
            {team.consecutiveLosses >= 3 && (
              <span style={{ color: 'red' }}> · ⚠️ {team.consecutiveLosses} derrotas seguidas (5 = demissão!)</span>
            )}
          </p>
          {team.loan && <p>Empréstimo: <Money value={-team.loan.amount} /> (juros {'-'}<Money value={loanInterest(team)} />/jogo)</p>}
          {team.cash < 0 && (
            <p style={{ color: 'red', fontWeight: 'bold' }}>
              ⚠️ Caixa negativo! Dívida grande por 3 rodadas = chicotada psicológica.
            </p>
          )}
        </div>

        <div className="panel grow">
          <h3>📅 {entry ? competitionLabel : 'Temporada encerrada'}</h3>
          {seasonOver ? (
            <p><b>Temporada encerrada!</b> Clique em "Encerrar temporada".</p>
          ) : opponent ? (
            <>
              <p style={{ fontSize: 16 }}>
                {isHome ? (<><b>{team.name}</b> x {opponent.name}</>) : (<>{opponent.name} x <b>{team.name}</b></>)}
              </p>
              <p>{isHome ? '🏟️ Em casa — a renda é sua!' : '✈️ Fora de casa (divisor 7000)'}</p>
              <p>
                Adversário: força média{' '}
                <b>{Math.round(opponent.players.reduce((s, p) => s + p.strength, 0) / Math.max(1, opponent.players.length))}</b>
                {' '}· moral {opponent.moral}/20 · técnico {opponent.managerName}
              </p>
              <p>
                Titulares aptos: <b style={{ color: startersOk < 11 ? 'red' : 'inherit' }}>{startersOk}/11</b>
                {startersOk < 11 && ' — ajuste a escalação!'}
              </p>
            </>
          ) : entry?.type === 'cup' ? (
            <p>Sua equipe não joga nesta jornada de taça {state.cup.eliminated.includes(team.id) ? '(eliminada)' : '(isenta ou fora)'}. Os outros jogos serão simulados.</p>
          ) : (
            <p>Sem jogo nesta jornada.</p>
          )}
          {(pendingRaises > 0 || myAuctions > 0) && (
            <p style={{ color: '#884400' }}>
              {pendingRaises > 0 && <>💰 {pendingRaises} pedido(s) de aumento pendente(s). </>}
              {myAuctions > 0 && <>🔨 {myAuctions} jogador(es) seu(s) em leilão. </>}
              Serão resolvidos ao jogar a rodada.
            </p>
          )}
        </div>
      </div>

      <div className="row">
        <button className="primary" style={{ fontSize: 16, padding: '8px 24px' }} onClick={onPlayRound}>
          {seasonOver ? '🏆 Encerrar temporada' : '⚽ JOGAR RODADA (J)'}
        </button>
      </div>

      <div className="panel">
        <h3>📰 Notícias</h3>
        {state.news.length === 0 && <p>Nada de novo por enquanto.</p>}
        {state.news.slice(0, 12).map((n, i) => (
          <div className="news-item" key={i}>
            <b>[T{n.season} J{n.round}]</b> {n.text}
          </div>
        ))}
      </div>
    </div>
  )
}

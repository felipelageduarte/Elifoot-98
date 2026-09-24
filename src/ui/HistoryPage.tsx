import { useState } from 'react'
import type { GameState } from '../engine/types'
import { deriveStats, resetStats } from '../engine/stats'
import { useConfirm } from './common'

type Tab = 'seasons' | 'ranking' | 'coach' | 'profile' | 'stats'

export function HistoryPage({
  state,
  activeTeamId,
  mutate,
}: {
  state: GameState
  activeTeamId: number
  mutate: (fn: () => void) => void
}) {
  const [tab, setTab] = useState<Tab>('seasons')
  const activeManager = state.managers.find((m) => m.teamId === activeTeamId && m.human)
  const [coachName, setCoachName] = useState(activeManager?.name ?? state.managers.find((m) => m.human)?.name ?? '')
  const confirm = useConfirm()

  const rankedManagers = state.managers
    .slice()
    .sort((a, b) => b.championships - a.championships || b.cups - a.cups || b.rankingPoints - a.rankingPoints)

  const coach = state.managers.find((m) => m.name === coachName)

  return (
    <div className="col">
      <div className="row">
        <button className={tab === 'seasons' ? 'primary' : ''} onClick={() => setTab('seasons')}>🏆 Temporadas</button>
        <button className={tab === 'ranking' ? 'primary' : ''} onClick={() => setTab('ranking')}>📊 Ranking de Treinadores</button>
        <button className={tab === 'coach' ? 'primary' : ''} onClick={() => setTab('coach')}>📖 História do Treinador</button>
        <button className={tab === 'profile' ? 'primary' : ''} onClick={() => setTab('profile')}>⚙️ Perfil do Treinador</button>
        <button className={tab === 'stats' ? 'primary' : ''} onClick={() => setTab('stats')}>📈 Estatísticas</button>
      </div>

      {tab === 'seasons' && (
        <div className="panel">
          {state.history.length === 0 && <p>Nenhuma temporada concluída ainda.</p>}
          {state.history.length > 0 && (
            <table className="grid">
              <thead>
                <tr>
                  <th>Temporada</th>
                  {state.divisions.map((d) => (<th key={d.level}>{d.name}</th>))}
                  <th>Taça</th>
                  <th>Artilheiro</th>
                </tr>
              </thead>
              <tbody>
                {state.history.map((h, i) => (
                  <tr key={i}>
                    <td><b>{h.season}</b></td>
                    {state.divisions.map((d) => (<td key={d.level}>{h.champions[d.level]}</td>))}
                    <td>🏆 {h.cupWinner}</td>
                    <td>{h.topScorer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'ranking' && (
        <div className="panel">
          <p style={{ fontSize: 12, margin: 4 }}>
            Critérios do original: campeonatos ▸ taças ▸ pontos (vitória fora 3, vitória em casa 2, empate fora 2, empate em casa 1).
          </p>
          <table className="grid">
            <thead>
              <tr><th>#</th><th>Treinador</th><th>Clube</th><th>Campeonatos</th><th>Taças</th><th>Pontos</th></tr>
            </thead>
            <tbody>
              {rankedManagers.slice(0, 30).map((m, i) => (
                <tr key={m.name + i} className={m.human ? 'row-starter' : ''}>
                  <td>{i + 1}º</td>
                  <td><b>{m.name}</b>{m.human && ' 👤'}{m.onVacation && ' (de férias)'}</td>
                  <td>{m.teamId !== null ? state.teams[m.teamId]?.name : 'Desempregado'}</td>
                  <td>{m.championships}</td>
                  <td>{m.cups}</td>
                  <td>{m.rankingPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'coach' && (
        <div className="panel">
          <div className="row">
            <label>Treinador:</label>
            <select value={coachName} onChange={(e) => setCoachName(e.target.value)}>
              {state.managers.filter((m) => m.human).map((m) => (
                <option key={m.name} value={m.name}>{m.name}</option>
              ))}
            </select>
          </div>
          {coach && (
            <table className="grid" style={{ marginTop: 8 }}>
              <tbody>
                {coach.history.length === 0 && (<tr><td>Nenhum evento registrado ainda.</td></tr>)}
                {coach.history.slice().reverse().map((h, i) => (
                  <tr key={i}>
                    <td style={{ width: 90 }}><b>{h.season || 'Início'}</b></td>
                    <td>{h.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'profile' && (
        <div className="col">
          {state.managers.filter((m) => m.human).map((m) => (
            <div className="panel" key={m.name}>
              <h3>👤 {m.name} {m.teamId !== null && `— ${state.teams[m.teamId]?.name}`}</h3>
              <div className="row">
                <label>
                  <input
                    type="checkbox"
                    checked={m.onVacation}
                    onChange={(e) => {
                      const on = e.target.checked
                      if (on) {
                        confirm.ask({
                          title: 'Entrar de férias',
                          message: (
                            <span>
                              Com <b>{m.name}</b> de férias, o computador assume o time (escalação automática,
                              aceita aumentos, sem partidas ao vivo). Confirmar?
                            </span>
                          ),
                          confirmLabel: 'Sair de férias',
                          action: () => mutate(() => { m.onVacation = true }),
                        })
                      } else {
                        mutate(() => { m.onVacation = false })
                      }
                    }}
                  />{' '}
                  🏖 De férias (o computador joga por você)
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={m.autoRaises}
                    onChange={(e) => mutate(() => { m.autoRaises = e.target.checked })}
                  />{' '}
                  💰 Gestão automática de salários (aceita pedidos de aumento)
                </label>
                <label>
                  Compra em leilão:{' '}
                  <select
                    value={m.auctionPolicy}
                    onChange={(e) => mutate(() => { m.auctionPolicy = e.target.value as typeof m.auctionPolicy })}
                  >
                    <option value="all">Quero ofertar em todos os leilões</option>
                    <option value="strong">Só nos jogadores mais fortes</option>
                    <option value="none">Não quero comprar em leilão</option>
                  </select>
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
      {tab === 'stats' && <StatsPanel state={state} mutate={mutate} confirm={confirm} />}
      {confirm.dialog}
    </div>
  )
}

function StatsPanel({
  state,
  mutate,
  confirm,
}: {
  state: GameState
  mutate: (fn: () => void) => void
  confirm: ReturnType<typeof useConfirm>
}) {
  const stats = state.stats
  const d = deriveStats(stats)

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <p style={{ fontSize: 12, margin: 0 }}>
          Desde a Temporada {stats.since.season}, Rodada {stats.since.round} · {stats.games} jogo(s) contabilizado(s)
          (a final da Taça, em campo neutro, não entra na conta).
        </p>
        <button
          onClick={() =>
            confirm.ask({
              title: 'Zerar estatísticas',
              message:
                'Isso apaga todos os contadores acumulados até agora. Use depois de mudar a Calibração para medir só os próximos jogos. Não afeta o andamento do jogo.',
              danger: true,
              confirmLabel: 'Zerar',
              action: () => mutate(() => resetStats(state)),
            })
          }
        >
          🔄 Zerar estatísticas
        </button>
      </div>

      {!d && <p>Jogue algumas rodadas para começar a ver as estatísticas aqui.</p>}

      {d && (
        <>
          <table className="grid" style={{ marginTop: 8 }}>
            <thead>
              <tr><th>Gols</th><th></th></tr>
            </thead>
            <tbody>
              <tr><td>Gols por jogo</td><td><b>{d.avgGoals.toFixed(2)}</b></td></tr>
              <tr><td>Gols do mandante por jogo</td><td>{d.avgHomeGoals.toFixed(2)}</td></tr>
              <tr><td>Gols do visitante por jogo</td><td>{d.avgAwayGoals.toFixed(2)}</td></tr>
              <tr><td>Jogos 0×0</td><td>{d.goallessPct.toFixed(1)}%</td></tr>
            </tbody>
          </table>

          <table className="grid" style={{ marginTop: 8 }}>
            <thead>
              <tr><th>Resultado</th><th></th></tr>
            </thead>
            <tbody>
              <tr><td>Vitórias do mandante</td><td><b>{d.homeWinPct.toFixed(1)}%</b></td></tr>
              <tr><td>Empates</td><td>{d.drawPct.toFixed(1)}%</td></tr>
              <tr><td>Vitórias do visitante</td><td>{d.awayWinPct.toFixed(1)}%</td></tr>
            </tbody>
          </table>

          <table className="grid" style={{ marginTop: 8 }}>
            <thead>
              <tr><th>Disciplina e pênaltis</th><th></th></tr>
            </thead>
            <tbody>
              <tr><td>Cartões amarelos por jogo</td><td><b>{d.avgYellow.toFixed(2)}</b></td></tr>
              <tr><td>Cartões vermelhos por jogo</td><td>{d.avgRed.toFixed(2)}</td></tr>
              <tr><td>Pênaltis marcados por jogo</td><td>{d.avgPenalties.toFixed(2)}</td></tr>
              <tr><td>Conversão de pênalti</td><td>{d.penaltyConversionPct.toFixed(0)}%</td></tr>
              <tr><td>Lesões por jogo</td><td>{d.avgInjuries.toFixed(2)}</td></tr>
            </tbody>
          </table>

          <p style={{ fontSize: 11, margin: '8px 0 0' }}>
            💡 Para verificar o efeito de um ajuste em Configurações → Calibração, zere as estatísticas
            logo depois de mudar o valor e jogue algumas rodadas.
          </p>
        </>
      )}
    </div>
  )
}

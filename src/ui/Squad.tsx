import { useState } from 'react'
import type { GameState, Player, Team } from '../engine/types'
import { POSITION_LABEL, BEHAVIOR_LABELS, playerDisplayName } from '../engine/types'
import { pickLineup, autoLineup, FORMATIONS } from '../engine/newgame'
import {
  playerValue, renewContract, toggleForSale, firePlayer, putOnAuction, cancelAuction, salaryDemand,
} from '../engine/transfers'
import { Money, fmtMoney, useConfirm } from './common'

export function Squad({
  state,
  team,
  mutate,
}: {
  state: GameState
  team: Team
  mutate: (fn: () => void) => void
}) {
  const [message, setMessage] = useState('')
  const [auctionTarget, setAuctionTarget] = useState<Player | null>(null)
  const [auctionPrice, setAuctionPrice] = useState(0)
  const [renewTarget, setRenewTarget] = useState<Player | null>(null)
  const [renewSalary, setRenewSalary] = useState(0)
  const confirm = useConfirm()

  const starters = team.lineup
  const sorted = team.players
    .slice()
    .sort((a, b) => 'GDMA'.indexOf(a.pos) - 'GDMA'.indexOf(b.pos) || b.strength - a.strength)

  const formationOf = (): string => {
    const ps = starters.map((id) => team.players.find((p) => p.id === id)).filter((p): p is Player => !!p)
    return `${ps.filter((p) => p.pos === 'D').length}-${ps.filter((p) => p.pos === 'M').length}-${ps.filter((p) => p.pos === 'A').length}`
  }

  const toggleStarter = (p: Player) => {
    mutate(() => {
      if (team.lineup.includes(p.id)) {
        team.lineup = team.lineup.filter((id) => id !== p.id)
      } else {
        if (team.lineup.length >= 11) return setMessage('Já há 11 titulares. Remova alguém antes.')
        if (p.suspendedGames > 0 || p.injuredGames > 0) return setMessage(`${p.name} não pode jogar (suspenso/machucado).`)
        if (p.pos === 'G' && starters.some((id) => team.players.find((x) => x.id === id)?.pos === 'G')) {
          return setMessage('Só um goleiro na escalação.')
        }
        team.lineup = [...team.lineup, p.id]
      }
    })
  }

  const starterPlayers = starters
    .map((id) => team.players.find((p) => p.id === id))
    .filter((p): p is Player => !!p)

  return (
    <div className="col">
      <div className="row">
        <b>Formação: {formationOf()}</b>
        <button
          className="primary"
          title="Testa as 12 formações e escolhe a de maior força total"
          onClick={() => mutate(() => { team.lineup = autoLineup(team.players).lineup })}
        >
          🤖 Automático (A)
        </button>
        <button
          title="Mantém a formação e escala os mais fortes"
          onClick={() => {
            const f = formationOf().split('-').map(Number)
            mutate(() => { team.lineup = pickLineup(team.players, f[0] ?? 4, f[1] ?? 4, f[2] ?? 2) })
          }}
        >
          ⭐ Melhores (M)
        </button>
      </div>
      <div className="row">
        {FORMATIONS.map(([d, m, a], i) => (
          <button
            key={`${d}${m}${a}`}
            title={`F${i + 1}`}
            onClick={() => mutate(() => { team.lineup = pickLineup(team.players, d, m, a) })}
          >
            {d}-{m}-{a}
          </button>
        ))}
        <button
          title="Uma formação sem meio-campo — arriscada, mas maximiza ataque e defesa"
          onClick={() => mutate(() => { team.lineup = pickLineup(team.players, 5, 0, 5) })}
        >
          5-0-5 🔥
        </button>
      </div>

      {message && (
        <div className="panel inset-gray">
          {message} <button onClick={() => setMessage('')}>OK</button>
        </div>
      )}

      {auctionTarget && (
        <div className="panel inset-gray">
          <b>Leiloar {playerDisplayName(auctionTarget)}</b> — lance mínimo:{' '}
          <input type="number" value={auctionPrice} step={50000} min={0} style={{ width: 130 }}
            onChange={(e) => setAuctionPrice(Number(e.target.value))} />
          <button
            className="primary"
            onClick={() =>
              confirm.ask({
                title: 'Colocar em leilão',
                message: (
                  <span>
                    Leiloar <b>{auctionTarget.name}</b> com lance mínimo de <b>{fmtMoney(auctionPrice)}</b>? O
                    leilão resolve na próxima rodada e a venda é irreversível.
                  </span>
                ),
                confirmLabel: 'Leiloar',
                action: () =>
                  mutate(() => {
                    const r = putOnAuction(state, team, auctionTarget, auctionPrice)
                    setMessage(r.message)
                    if (r.accepted) setAuctionTarget(null)
                  }),
              })
            }
          >
            Confirmar leilão
          </button>
          <button onClick={() => setAuctionTarget(null)}>Cancelar</button>
        </div>
      )}

      {renewTarget && (
        <div className="panel inset-gray">
          <b>Renovar contrato de {playerDisplayName(renewTarget)}</b> — pretende{' '}
          <b>{fmtMoney(salaryDemand(renewTarget, state.inflation))}</b>/jogo. Novo salário:{' '}
          <input type="number" value={renewSalary} step={50} min={0} style={{ width: 110 }}
            onChange={(e) => setRenewSalary(Number(e.target.value))} />
          <button
            className="primary"
            onClick={() =>
              mutate(() => {
                const r = renewContract(state, team, renewTarget, renewSalary)
                setMessage(r.message)
                if (r.accepted) setRenewTarget(null)
              })
            }
          >
            Propor
          </button>
          <button onClick={() => setRenewTarget(null)}>Cancelar</button>
        </div>
      )}

      <div className="field">
        {(['A', 'M', 'D', 'G'] as const).map((pos) => (
          <div className="field-row" key={pos}>
            {starterPlayers
              .filter((p) => p.pos === pos)
              .map((p) => (
                <div className="field-player" key={p.id}>
                  <span className={`pos-${p.pos}`}>{p.pos}</span> {playerDisplayName(p)}
                  <br />⭐{p.strength}
                  {p.nationality !== team.country ? ` 🌎${p.nationality}` : ''}
                </div>
              ))}
          </div>
        ))}
      </div>

      <div className="panel">
        <table className="grid">
          <thead>
            <tr>
              <th>Tit.</th>
              <th>Nome</th>
              <th>Pos.</th>
              <th>Força</th>
              <th>Idade</th>
              <th>País</th>
              <th>Comport.</th>
              <th>Contrato</th>
              <th>Salário</th>
              <th>Valor</th>
              <th>Gols</th>
              <th>Situação</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const starter = starters.includes(p.id)
              return (
                <tr key={p.id} className={starter ? 'row-starter' : ''}>
                  <td>
                    <input type="checkbox" checked={starter} onChange={() => toggleStarter(p)} />
                  </td>
                  <td>
                    <b>{playerDisplayName(p)}</b>
                    {p.nationality === team.country && ' 🏠'}
                  </td>
                  <td className={`pos-${p.pos}`}>{POSITION_LABEL[p.pos]}</td>
                  <td><b>{p.strength}</b></td>
                  <td>{p.age}</td>
                  <td>{p.nationality}</td>
                  <td style={{ fontSize: 11 }}>{BEHAVIOR_LABELS[p.behavior]}</td>
                  <td className={p.contractGames <= 5 ? 'st-susp' : ''}>
                    {p.contractGames} jogos
                  </td>
                  <td>{fmtMoney(p.salary)}</td>
                  <td><Money value={playerValue(p, team, state.inflation)} /></td>
                  <td>{p.goals}</td>
                  <td>
                    {p.suspendedGames > 0 && <span className="st-susp">Susp. {p.suspendedGames}j </span>}
                    {p.injuredGames > 0 && <span className="st-inj">🚑 {p.injuredGames}j </span>}
                    {p.yellowCards > 0 && <span>🟨×{p.yellowCards} </span>}
                    {p.auction && <span className="st-auction">Em leilão </span>}
                    {p.forSale && <span className="st-sale">À venda </span>}
                    {p.blockedUntilSeason > state.seasonNumber && <span title="Só pode ser vendido na próxima época">🔒</span>}
                  </td>
                  <td>
                    <div className="squad-actions">
                      <button
                        title="Renovar contrato"
                        onClick={() => {
                          setRenewTarget(p)
                          setRenewSalary(salaryDemand(p, state.inflation))
                        }}
                      >
                        Renovar
                      </button>
                      {p.auction ? (
                        <button onClick={() => mutate(() => { cancelAuction(state, p); setMessage('Leilão cancelado.') })}>
                          Tirar do leilão
                        </button>
                      ) : (
                        <button
                          title="Vender em leilão (resolve na próxima rodada)"
                          onClick={() => {
                            setAuctionTarget(p)
                            setAuctionPrice(Math.round(playerValue(p, team, state.inflation) * 0.8))
                          }}
                        >
                          Leiloar
                        </button>
                      )}
                      <button title="Listar para ofertas diretas" onClick={() => mutate(() => toggleForSale(p))}>
                        {p.forSale ? 'Tirar da lista' : 'Listar'}
                      </button>
                      <button
                        title="Rescindir contrato"
                        onClick={() =>
                          confirm.ask({
                            title: 'Rescindir contrato',
                            message: (
                              <span>
                                Rescindir com <b>{p.name}</b> custa{' '}
                                <b>{fmtMoney(Math.round((p.contractGames * p.salary) / 2))}</b> e o jogador vira
                                agente livre. Irreversível. Confirmar?
                              </span>
                            ),
                            danger: true,
                            confirmLabel: 'Rescindir',
                            action: () =>
                              mutate(() => {
                                const r = firePlayer(team, state, p)
                                setMessage(r.message)
                              }),
                          })
                        }
                      >
                        Rescindir
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="row" style={{ fontSize: 12 }}>
        <span>Titulares: <b>{starters.length}/11</b></span>
        <span>· +3 por titular da nacionalidade do clube 🏠</span>
        <span>· `*` = craque (+25% finalização/pênalti)</span>
        <span>· Moral do time: <b>{team.moral}/20</b></span>
        <span>· Elenco: {team.players.length}/24 (mín. 11)</span>
      </div>
      {confirm.dialog}
    </div>
  )
}

import { useState } from 'react'
import type { GameState, Player, Position, Team } from '../engine/types'
import { POSITION_LABEL, BEHAVIOR_LABELS, playerDisplayName } from '../engine/types'
import { makeOffer, playerValue, signFreeAgent } from '../engine/transfers'
import { Money, fmtMoney, TeamChip, useConfirm } from './common'

type Tab = 'auctions' | 'market' | 'free' | 'search' | 'observed' | 'log' | 'scout'

export function Transfers({
  state,
  team,
  mutate,
}: {
  state: GameState
  team: Team
  mutate: (fn: () => void) => void
}) {
  const [tab, setTab] = useState<Tab>('auctions')
  const [scoutTeamId, setScoutTeamId] = useState<number>(
    Object.values(state.teams).find((t) => t.id !== team.id)?.id ?? team.id,
  )
  const [message, setMessage] = useState('')
  const [offerTarget, setOfferTarget] = useState<{ player: Player; seller: Team } | null>(null)
  const [offerAmount, setOfferAmount] = useState(0)
  const confirm = useConfirm()

  // pesquisa
  const [qName, setQName] = useState('')
  const [qPos, setQPos] = useState<'' | Position>('')
  const [qMinStr, setQMinStr] = useState(0)
  const [qMaxPrice, setQMaxPrice] = useState(0)
  const [qNat, setQNat] = useState('')
  const [searchResults, setSearchResults] = useState<{ player: Player; owner: Team }[]>([])

  const managerKey = team.managerName ?? ''
  const observed = state.observed[managerKey] ?? []

  const forSalePlayers: { player: Player; seller: Team }[] = []
  for (const t of Object.values(state.teams)) {
    if (t.id === team.id) continue
    for (const p of t.players.filter((x) => x.forSale && !x.auction)) forSalePlayers.push({ player: p, seller: t })
  }
  forSalePlayers.sort((a, b) => b.player.strength - a.player.strength)

  const activeAuctions = state.auctions
    .map((a) => {
      const seller = state.teams[a.sellerTeamId]
      const player = seller?.players.find((p) => p.id === a.playerId)
      return player && seller ? { auction: a, player, seller } : null
    })
    .filter((x): x is NonNullable<typeof x> => !!x)

  const scoutTeam = state.teams[scoutTeamId]

  const startOffer = (player: Player, seller: Team) => {
    setOfferTarget({ player, seller })
    setOfferAmount(playerValue(player, team, state.inflation))
  }

  const runSearch = () => {
    const results: { player: Player; owner: Team }[] = []
    for (const t of Object.values(state.teams)) {
      if (t.id === team.id) continue
      for (const p of t.players) {
        if (qName && !p.name.toLowerCase().includes(qName.toLowerCase())) continue
        if (qPos && p.pos !== qPos) continue
        if (qMinStr && p.strength < qMinStr) continue
        if (qNat && p.nationality !== qNat.toUpperCase()) continue
        if (qMaxPrice && playerValue(p, team, state.inflation) > qMaxPrice) continue
        results.push({ player: p, owner: t })
        if (results.length >= 50) break
      }
      if (results.length >= 50) break
    }
    setSearchResults(results.sort((a, b) => b.player.strength - a.player.strength))
  }

  const toggleObserved = (p: Player) => {
    mutate(() => {
      const list = state.observed[managerKey] ?? []
      if (list.some((o) => o.playerId === p.id)) {
        state.observed[managerKey] = list.filter((o) => o.playerId !== p.id)
      } else {
        if (list.length >= 15) {
          setMessage('Só pode ter 15 jogadores sob observação.')
          return
        }
        state.observed[managerKey] = [...list, { playerId: p.id, note: '' }]
      }
    })
  }

  const findPlayerAnywhere = (playerId: number): { player: Player; owner: Team | null } | null => {
    for (const t of Object.values(state.teams)) {
      const p = t.players.find((x) => x.id === playerId)
      if (p) return { player: p, owner: t }
    }
    const fa = state.freeAgents.find((x) => x.id === playerId)
    return fa ? { player: fa, owner: null } : null
  }

  return (
    <div className="col">
      <div className="row">
        <button className={tab === 'auctions' ? 'primary' : ''} onClick={() => setTab('auctions')}>
          🔨 Leilões ({activeAuctions.length})
        </button>
        <button className={tab === 'market' ? 'primary' : ''} onClick={() => setTab('market')}>
          🏷️ À venda ({forSalePlayers.length})
        </button>
        <button className={tab === 'free' ? 'primary' : ''} onClick={() => setTab('free')}>
          🆓 Livres ({state.freeAgents.length})
        </button>
        <button className={tab === 'search' ? 'primary' : ''} onClick={() => setTab('search')}>
          🔍 Procurar
        </button>
        <button className={tab === 'observed' ? 'primary' : ''} onClick={() => setTab('observed')}>
          👁 Observados ({observed.length})
        </button>
        <button className={tab === 'log' ? 'primary' : ''} onClick={() => setTab('log')}>
          📜 Últimas transferências
        </button>
        <button className={tab === 'scout' ? 'primary' : ''} onClick={() => setTab('scout')}>
          🔭 Observar clubes
        </button>
        <span className="grow" />
        <span>Caixa: <Money value={team.cash} /></span>
      </div>

      {message && (
        <div className="panel inset-gray">
          {message} <button onClick={() => setMessage('')}>OK</button>
        </div>
      )}

      {offerTarget && (
        <div className="panel inset-gray">
          <div className="row">
            <b>Oferta por {playerDisplayName(offerTarget.player)} ({offerTarget.seller.name})</b>
            <span>Valor: {fmtMoney(playerValue(offerTarget.player, team, state.inflation))}</span>
            <input type="number" value={offerAmount} step={50000}
              onChange={(e) => setOfferAmount(Number(e.target.value))} style={{ width: 140 }} />
            <button
              className="primary"
              onClick={() =>
                confirm.ask({
                  title: 'Enviar oferta',
                  message: (
                    <span>
                      Oferecer <b>{fmtMoney(offerAmount)}</b> por <b>{offerTarget.player.name}</b>? Se aceita, a
                      transferência é imediata e irreversível.
                    </span>
                  ),
                  confirmLabel: 'Enviar oferta',
                  action: () =>
                    mutate(() => {
                      const r = makeOffer(state, team, offerTarget.seller, offerTarget.player, offerAmount)
                      setMessage(r.message)
                      if (r.accepted) setOfferTarget(null)
                    }),
                })
              }
            >
              Enviar oferta
            </button>
            <button onClick={() => setOfferTarget(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {tab === 'auctions' && (
        <div className="panel">
          <p style={{ margin: 4, fontSize: 12 }}>
            💡 Leilões resolvem na próxima rodada. Você dará seus lances quando clicar em JOGAR RODADA.
          </p>
          {activeAuctions.length === 0 && <p>Nenhum leilão em andamento.</p>}
          {activeAuctions.length > 0 && (
            <table className="grid">
              <thead>
                <tr><th>Jogador</th><th>Clube</th><th>Pos.</th><th>Força</th><th>Comport.</th><th>Lance mínimo</th><th>Resolve</th></tr>
              </thead>
              <tbody>
                {activeAuctions.map(({ auction, player, seller }) => (
                  <tr key={player.id}>
                    <td><b>{playerDisplayName(player)}</b></td>
                    <td>{seller.name}</td>
                    <td className={`pos-${player.pos}`}>{player.pos}</td>
                    <td><b>{player.strength}</b></td>
                    <td style={{ fontSize: 11 }}>{BEHAVIOR_LABELS[player.behavior]}</td>
                    <td><Money value={auction.minPrice} /></td>
                    <td>{auction.createdRound < state.currentMatchday ? 'nesta rodada' : 'próxima rodada'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'market' && (
        <div className="panel">
          <PlayerTable
            state={state} team={team}
            players={forSalePlayers.map((x) => x.player)}
            ownerOf={(p) => forSalePlayers.find((x) => x.player.id === p.id)?.seller}
            actionLabel="Fazer oferta"
            onAction={(p) => {
              const seller = forSalePlayers.find((x) => x.player.id === p.id)?.seller
              if (seller) startOffer(p, seller)
            }}
            observed={observed} onObserve={toggleObserved}
          />
        </div>
      )}

      {tab === 'free' && (
        <div className="panel">
          <PlayerTable
            state={state} team={team}
            players={state.freeAgents.slice().sort((a, b) => b.strength - a.strength)}
            actionLabel="Contratar (luvas 20%)"
            onAction={(p) =>
              confirm.ask({
                title: 'Contratar agente livre',
                message: (
                  <span>
                    Contratar <b>{p.name}</b> custa{' '}
                    <b>{fmtMoney(Math.round(playerValue(p, team, state.inflation) * 0.2))}</b> de luvas +
                    salário de {fmtMoney(p.salary)}/jogo. Confirmar?
                  </span>
                ),
                confirmLabel: 'Contratar',
                action: () =>
                  mutate(() => {
                    const r = signFreeAgent(state, team, p)
                    setMessage(r.message)
                  }),
              })
            }
            observed={observed} onObserve={toggleObserved}
          />
        </div>
      )}

      {tab === 'search' && (
        <div className="col">
          <div className="panel">
            <div className="row">
              <label>Nome:</label>
              <input value={qName} onChange={(e) => setQName(e.target.value)} style={{ width: 130 }} />
              <label>Posição:</label>
              <select value={qPos} onChange={(e) => setQPos(e.target.value as '' | Position)}>
                <option value="">Qualquer</option>
                <option value="G">Goleiro</option>
                <option value="D">Defesa</option>
                <option value="M">Meio-campo</option>
                <option value="A">Atacante</option>
              </select>
              <label>Força ≥</label>
              <input type="number" value={qMinStr} min={0} max={50} style={{ width: 55 }}
                onChange={(e) => setQMinStr(Number(e.target.value))} />
              <label>País:</label>
              <input value={qNat} maxLength={3} placeholder="BRA" style={{ width: 55 }}
                onChange={(e) => setQNat(e.target.value)} />
              <label>Preço até:</label>
              <input type="number" value={qMaxPrice} step={100000} min={0} style={{ width: 110 }}
                onChange={(e) => setQMaxPrice(Number(e.target.value))} />
              <button className="primary" onClick={runSearch}>🔍 Procurar</button>
            </div>
            <p style={{ fontSize: 11, margin: '4px 0 0' }}>Só são listados os primeiros 50 jogadores encontrados.</p>
          </div>
          <div className="panel">
            <PlayerTable
              state={state} team={team}
              players={searchResults.map((r) => r.player)}
              ownerOf={(p) => searchResults.find((r) => r.player.id === p.id)?.owner}
              actionLabel="Fazer oferta"
              onAction={(p) => {
                const owner = searchResults.find((r) => r.player.id === p.id)?.owner
                if (owner) startOffer(p, owner)
              }}
              observed={observed} onObserve={toggleObserved}
            />
          </div>
        </div>
      )}

      {tab === 'observed' && (
        <div className="panel">
          {observed.length === 0 && <p>Nenhum jogador sob observação. Use o 👁 nas outras abas (máx. 15).</p>}
          {observed.length > 0 && (
            <table className="grid">
              <thead>
                <tr><th>Jogador</th><th>Clube</th><th>Pos.</th><th>Força</th><th>Valor</th><th>Situação</th><th>Nota</th><th></th></tr>
              </thead>
              <tbody>
                {observed.map((o) => {
                  const found = findPlayerAnywhere(o.playerId)
                  if (!found) return null
                  const { player: p, owner } = found
                  return (
                    <tr key={o.playerId}>
                      <td><b>{playerDisplayName(p)}</b></td>
                      <td>{owner?.name ?? 'Sem clube'}</td>
                      <td className={`pos-${p.pos}`}>{p.pos}</td>
                      <td><b>{p.strength}</b></td>
                      <td><Money value={playerValue(p, team, state.inflation)} /></td>
                      <td>{p.auction ? '🔨 EM LEILÃO!' : p.forSale ? 'À venda' : '—'}</td>
                      <td>
                        <input
                          value={o.note}
                          placeholder="anotações..."
                          onChange={(e) => mutate(() => { o.note = e.target.value })}
                          style={{ width: 160 }}
                        />
                      </td>
                      <td>
                        <div className="row" style={{ gap: 2 }}>
                          {owner && owner.id !== team.id && (
                            <button onClick={() => startOffer(p, owner)}>Oferta</button>
                          )}
                          <button onClick={() => toggleObserved(p)}>Remover</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="panel">
          {state.transferLog.length === 0 && <p>Nenhuma transferência registrada ainda.</p>}
          {state.transferLog.length > 0 && (
            <table className="grid">
              <thead>
                <tr><th>Quando</th><th>Jogador</th><th>De</th><th>Para</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
              </thead>
              <tbody>
                {state.transferLog.map((t, i) => (
                  <tr key={i}>
                    <td>T{t.season} R{t.round}</td>
                    <td><b>{t.playerName}</b></td>
                    <td>{t.fromTeam}</td>
                    <td>{t.toTeam}</td>
                    <td style={{ textAlign: 'right' }}><Money value={t.amount} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'scout' && (
        <div className="col">
          <div className="row">
            <label>Clube:</label>
            <select value={scoutTeamId} onChange={(e) => setScoutTeamId(Number(e.target.value))}>
              {state.divisions.map((d) => (
                <optgroup key={d.level} label={d.name}>
                  {d.teamIds.filter((id) => id !== team.id).map((id) => (
                    <option key={id} value={id}>{state.teams[id].name}</option>
                  ))}
                </optgroup>
              ))}
              {state.distritalTeamIds.length > 0 && (
                <optgroup label="Distrital">
                  {state.distritalTeamIds.map((id) => (
                    <option key={id} value={id}>{state.teams[id].name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <TeamChip colors={scoutTeam.colors} />
            <b>{scoutTeam.name}</b>
            <span>Técnico: {scoutTeam.managerName}</span>
            <span>Moral: {scoutTeam.moral}/20</span>
            <span>Caixa: <Money value={scoutTeam.cash} /></span>
          </div>
          <div className="panel">
            <PlayerTable
              state={state} team={team}
              players={scoutTeam.players.slice().sort((a, b) => 'GDMA'.indexOf(a.pos) - 'GDMA'.indexOf(b.pos) || b.strength - a.strength)}
              highlight={(p) => scoutTeam.lineup.includes(p.id)}
              actionLabel="Fazer oferta"
              onAction={(p) => startOffer(p, scoutTeam)}
              observed={observed} onObserve={toggleObserved}
            />
          </div>
          <p style={{ fontSize: 12, margin: 2 }}>
            💡 Titulares custam ~150% do valor. Listados à venda saem por ~80%. Limites: 24 no elenco, 5 estrangeiros (acordos de livre circulação não contam).
          </p>
        </div>
      )}
      {confirm.dialog}
    </div>
  )
}

function PlayerTable({
  state,
  team,
  players,
  ownerOf,
  highlight,
  actionLabel,
  onAction,
  observed,
  onObserve,
}: {
  state: GameState
  team: Team
  players: Player[]
  ownerOf?: (p: Player) => Team | undefined
  highlight?: (p: Player) => boolean
  actionLabel: string
  onAction: (p: Player) => void
  observed: { playerId: number }[]
  onObserve: (p: Player) => void
}) {
  if (players.length === 0) return <p>Nenhum jogador disponível.</p>
  return (
    <table className="grid">
      <thead>
        <tr>
          <th>Nome</th>
          {ownerOf && <th>Clube</th>}
          <th>Pos.</th>
          <th>Força</th>
          <th>Idade</th>
          <th>País</th>
          <th>Comport.</th>
          <th>Valor</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => (
          <tr key={p.id} className={highlight?.(p) ? 'row-starter' : ''}>
            <td>
              <b>{playerDisplayName(p)}</b>
              {highlight?.(p) && ' (titular)'}
            </td>
            {ownerOf && <td>{ownerOf(p)?.name}</td>}
            <td className={`pos-${p.pos}`}>{POSITION_LABEL[p.pos]}</td>
            <td><b>{p.strength}</b></td>
            <td>{p.age}</td>
            <td>{p.nationality}</td>
            <td style={{ fontSize: 11 }}>{BEHAVIOR_LABELS[p.behavior]}</td>
            <td><Money value={playerValue(p, team, state.inflation)} /></td>
            <td>
              <div className="row" style={{ gap: 2 }}>
                <button onClick={() => onAction(p)}>{actionLabel}</button>
                <button
                  title="Observar jogador"
                  onClick={() => onObserve(p)}
                  style={observed.some((o) => o.playerId === p.id) ? { fontWeight: 'bold' } : undefined}
                >
                  👁
                </button>
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

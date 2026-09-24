import { useState } from 'react'
import type { Behavior, GameState, Player, Position } from '../engine/types'
import { BEHAVIOR_LABELS } from '../engine/types'
import { generateSquad, defaultLineup, makeFreePlayer, strengthFromLevel } from '../engine/newgame'
import { DIVISION_LEVEL } from '../data/teams'
import { useConfirm } from './common'

// Editor de Equipes — como o "Editor de Equipas" do Elifoot original.
// Permite renomear clubes (criar times personalizados), mudar cores e
// editar/criar/remover jogadores livremente.
export function EditorPage({
  state,
  mutate,
}: {
  state: GameState
  mutate: (fn: () => void) => void
}) {
  const [teamId, setTeamId] = useState(Object.values(state.teams)[0].id)
  const [newPos, setNewPos] = useState<Position>('A')
  const confirm = useConfirm()
  const team = state.teams[teamId]

  const setPlayer = (p: Player, patch: Partial<Player>) => {
    mutate(() => {
      Object.assign(p, patch)
      if (patch.strength !== undefined) {
        p.strength = Math.max(1, Math.min(50, Math.round(patch.strength)))
      }
      if (patch.pos) team.lineup = defaultLineup(team.players)
    })
  }

  return (
    <div className="col">
      <div className="panel inset-gray">
        ⚠️ Editor livre, no espírito do "Editor de Equipas" original: as alterações valem para o jogo
        em andamento. Para criar um time novo, renomeie um clube existente e edite o elenco.
      </div>

      <div className="row">
        <label>Clube:</label>
        <select value={teamId} onChange={(e) => setTeamId(Number(e.target.value))}>
          {state.divisions.map((d) => (
            <optgroup key={d.level} label={d.name}>
              {d.teamIds.map((id) => (
                <option key={id} value={id}>
                  {state.teams[id].name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="panel">
        <h3>Identidade do clube</h3>
        <div className="row">
          <label>Nome:</label>
          <input value={team.name} onChange={(e) => mutate(() => { team.name = e.target.value })} />
          <label>Sigla:</label>
          <input
            value={team.short}
            maxLength={3}
            style={{ width: 50 }}
            onChange={(e) => mutate(() => { team.short = e.target.value.toUpperCase() })}
          />
          <label>Cores:</label>
          <input
            type="color"
            value={team.colors[0]}
            onChange={(e) => mutate(() => { team.colors = [e.target.value, team.colors[1]] })}
          />
          <input
            type="color"
            value={team.colors[1]}
            onChange={(e) => mutate(() => { team.colors = [team.colors[0], e.target.value] })}
          />
          <label>Capacidade do estádio:</label>
          <input
            type="number"
            value={team.stadiumCapacity}
            step={1000}
            style={{ width: 100 }}
            onChange={(e) => mutate(() => { team.stadiumCapacity = Math.max(1000, Number(e.target.value)) })}
          />
          <label>Torcida:</label>
          <input
            type="number"
            value={team.fanCount}
            step={10000}
            style={{ width: 110 }}
            onChange={(e) => mutate(() => { team.fanCount = Math.max(1000, Number(e.target.value)) })}
          />
        </div>
      </div>

      <div className="panel">
        <div className="row">
          <h3 className="grow">Elenco ({team.players.length} jogadores)</h3>
          <select value={newPos} onChange={(e) => setNewPos(e.target.value as Position)}>
            <option value="G">Goleiro</option>
            <option value="D">Defesa</option>
            <option value="M">Meio-campo</option>
            <option value="A">Atacante</option>
          </select>
          <button
            onClick={() =>
              mutate(() => {
                const level = DIVISION_LEVEL[Math.min(team.division, 4) - 1]
                const p = makeFreePlayer(newPos, strengthFromLevel(level, newPos))
                team.players.push(p)
                team.lineup = defaultLineup(team.players)
              })
            }
          >
            + Adicionar jogador
          </button>
          <button
            onClick={() =>
              confirm.ask({
                title: 'Gerar elenco novo',
                message: (
                  <span>
                    Substituir TODO o elenco do <b>{team.name}</b> por um elenco gerado do nível da{' '}
                    divisão atual? Esta ação não pode ser desfeita.
                  </span>
                ),
                danger: true,
                confirmLabel: 'Substituir elenco',
                action: () =>
                  mutate(() => {
                    team.players = generateSquad(team.division)
                    team.lineup = defaultLineup(team.players)
                  }),
              })
            }
          >
            🎲 Gerar elenco novo
          </button>
        </div>
        <table className="grid">
          <thead>
            <tr>
              <th>Nome</th>
              <th>⭐</th>
              <th>Pos.</th>
              <th>Força (1-50)</th>
              <th>Idade</th>
              <th>País</th>
              <th>Comportamento</th>
              <th>Contrato</th>
              <th>Salário</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((p) => (
              <tr key={p.id}>
                <td>
                  <input value={p.name} style={{ width: 160 }} onChange={(e) => setPlayer(p, { name: e.target.value })} />
                </td>
                <td>
                  <input
                    type="checkbox"
                    title="Craque (asterisco)"
                    checked={p.star}
                    onChange={(e) => setPlayer(p, { star: e.target.checked })}
                  />
                </td>
                <td>
                  <select value={p.pos} onChange={(e) => setPlayer(p, { pos: e.target.value as Position })}>
                    <option value="G">G</option>
                    <option value="D">D</option>
                    <option value="M">M</option>
                    <option value="A">A</option>
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={p.strength}
                    min={1}
                    max={50}
                    style={{ width: 60 }}
                    onChange={(e) => setPlayer(p, { strength: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={p.age}
                    min={16}
                    max={45}
                    style={{ width: 55 }}
                    onChange={(e) => setPlayer(p, { age: Number(e.target.value) })}
                  />
                </td>
                <td>
                  <input
                    value={p.nationality}
                    maxLength={3}
                    style={{ width: 48 }}
                    onChange={(e) => setPlayer(p, { nationality: e.target.value.toUpperCase() })}
                  />
                </td>
                <td>
                  <select
                    value={p.behavior}
                    onChange={(e) => setPlayer(p, { behavior: Number(e.target.value) as Behavior })}
                  >
                    {BEHAVIOR_LABELS.map((label, i) => (
                      <option key={i} value={i}>{label}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    value={p.contractGames}
                    min={1}
                    style={{ width: 60 }}
                    onChange={(e) => setPlayer(p, { contractGames: Math.max(1, Number(e.target.value)) })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    value={p.salary}
                    step={100}
                    style={{ width: 90 }}
                    onChange={(e) => setPlayer(p, { salary: Math.max(0, Number(e.target.value)) })}
                  />
                </td>
                <td>
                  <button
                    onClick={() =>
                      confirm.ask({
                        title: 'Remover jogador',
                        message: (
                          <span>
                            Remover <b>{p.name}</b> do elenco do {team.name}? O jogador deixa de existir.
                          </span>
                        ),
                        danger: true,
                        confirmLabel: 'Remover',
                        action: () =>
                          mutate(() => {
                            team.players = team.players.filter((x) => x.id !== p.id)
                            team.lineup = defaultLineup(team.players)
                          }),
                      })
                    }
                  >
                    🗑
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {confirm.dialog}
    </div>
  )
}

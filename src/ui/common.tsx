import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Settings } from '../engine/settings'
import { DEFAULT_SETTINGS } from '../engine/settings'
import type { GameState } from '../engine/types'
import { DISTRITAL, POSITION_LABEL, BEHAVIOR_LABELS, playerDisplayName } from '../engine/types'
import { playerValue } from '../engine/transfers'

// ---------- contexto de configurações ----------

export const SettingsContext = createContext<{
  settings: Settings
  update: (patch: Partial<Settings>) => void
}>({ settings: DEFAULT_SETTINGS, update: () => {} })

export function useSettings() {
  return useContext(SettingsContext)
}

// ---------- confirmação de ações "one-way door" ----------

export interface PendingConfirm {
  title: string
  message: ReactNode
  confirmLabel?: string
  danger?: boolean
  action: () => void
}

// Hook: pede confirmação antes de executar (respeita a configuração do usuário).
// `settingsOverride` permite uso fora do SettingsContext (ex.: no próprio App).
export function useConfirm(settingsOverride?: Settings) {
  const ctx = useSettings()
  const settings = settingsOverride ?? ctx.settings
  const [pending, setPending] = useState<PendingConfirm | null>(null)

  const ask = (c: PendingConfirm) => {
    if (!settings.confirmations) {
      c.action()
      return
    }
    setPending(c)
  }

  const dialog = pending ? (
    <Dialog title={pending.title} onClose={() => setPending(null)}>
      <div style={{ marginBottom: 10 }}>{pending.message}</div>
      <div className="row">
        <button
          className={`primary${pending.danger ? ' danger' : ''}`}
          autoFocus
          onClick={() => {
            pending.action()
            setPending(null)
          }}
        >
          {pending.confirmLabel ?? 'Confirmar'}
        </button>
        <button onClick={() => setPending(null)}>Cancelar</button>
      </div>
    </Dialog>
  ) : null

  return { ask, dialog }
}

export function fmtMoney(v: number): string {
  const abs = Math.abs(v)
  const str = `$${abs.toLocaleString('pt-BR')}`
  return v < 0 ? `-${str}` : str
}

export function Money({ value }: { value: number }) {
  return <span className={`money${value < 0 ? ' negative' : ''}`}>{fmtMoney(value)}</span>
}

export function Window({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="window">
      <div className="window-title">
        <span>{title}</span>
        {onClose && (
          <button onClick={onClose} style={{ padding: '0 8px', fontWeight: 'bold' }}>
            ×
          </button>
        )}
      </div>
      <div className="window-body">{children}</div>
    </div>
  )
}

export function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose?: () => void }) {
  return (
    <div
      className="dialog-backdrop"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && onClose) onClose()
      }}
    >
      <div className="dialog">
        <Window title={title} onClose={onClose}>
          {children}
        </Window>
      </div>
    </div>
  )
}

// ---------- menu com submenu (dropdown) — como o menu original do Elifoot ----------
// (Elifoot/Seleccionar/Equipa/Jogador/Campeonato/Treinador eram todos
// dropdowns, não abas soltas). Agrupa telas relacionadas para a barra
// principal não quebrar linha.

export function MenuDropdown({
  label,
  active,
  children,
}: {
  label: string
  active: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="menu-dropdown" ref={ref}>
      <button className={active ? 'active' : ''} onClick={() => setOpen((o) => !o)}>
        {label} {open ? '▴' : '▾'}
      </button>
      {open && (
        <div className="menu-dropdown-panel" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

export function TeamChip({ colors }: { colors: [string, string] }) {
  return (
    <span
      className="team-chip"
      style={{ background: `linear-gradient(135deg, ${colors[0]} 50%, ${colors[1]} 50%)` }}
    />
  )
}

// Clube clicável: em qualquer lista/tabela, clicar no nome abre o plantel
// (como o "Plantel" do original, acessível de qualquer tela por qualquer
// equipa via ComboCurrentTeam).
export function TeamLink({ state, teamId, onOpen }: { state: GameState; teamId: number; onOpen: (id: number) => void }) {
  const team = state.teams[teamId]
  return (
    <button
      className="team-link"
      title="Ver plantel"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(teamId)
      }}
    >
      <TeamChip colors={team.colors} /> {team.name}
    </button>
  )
}

// Diálogo de Plantel: identidade, técnico, moral,
// elenco completo com posição/força/idade/país/comportamento/valor.
export function TeamRosterDialog({
  state,
  teamId,
  onClose,
}: {
  state: GameState
  teamId: number
  onClose: () => void
}) {
  const team = state.teams[teamId]
  const divisionName =
    team.division === DISTRITAL ? 'Distrital' : state.divisions.find((d) => d.level === team.division)?.name ?? '—'
  const sorted = team.players
    .slice()
    .sort((a, b) => 'GDMA'.indexOf(a.pos) - 'GDMA'.indexOf(b.pos) || b.strength - a.strength)

  return (
    <Dialog title={`${team.name} — ${divisionName}`} onClose={onClose}>
      <div className="row" style={{ marginBottom: 8 }}>
        <TeamChip colors={team.colors} />
        <b>{team.name}</b>
        <span>Técnico: <b>{team.managerName}</b></span>
        <span>Moral: {team.moral}/20</span>
        <span>Caixa: <Money value={team.cash} /></span>
        <span>Elenco: {team.players.length}</span>
      </div>
      <div className="panel" style={{ maxHeight: 420, overflowY: 'auto' }}>
        <table className="grid">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Pos.</th>
              <th>Força</th>
              <th>Idade</th>
              <th>País</th>
              <th>Comport.</th>
              <th>Valor</th>
              <th>Gols</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => (
              <tr key={p.id} className={team.lineup.includes(p.id) ? 'row-starter' : ''}>
                <td><b>{playerDisplayName(p)}</b></td>
                <td className={`pos-${p.pos}`}>{POSITION_LABEL[p.pos]}</td>
                <td><b>{p.strength}</b></td>
                <td>{p.age}</td>
                <td>{p.nationality}</td>
                <td style={{ fontSize: 11 }}>{BEHAVIOR_LABELS[p.behavior]}</td>
                <td><Money value={playerValue(p, undefined, state.inflation)} /></td>
                <td>{p.goals}</td>
                <td>
                  {p.suspendedGames > 0 && <span className="st-susp">Susp. {p.suspendedGames}j </span>}
                  {p.injuredGames > 0 && <span className="st-inj">🚑 {p.injuredGames}j </span>}
                  {p.auction && <span className="st-auction">Em leilão</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Dialog>
  )
}

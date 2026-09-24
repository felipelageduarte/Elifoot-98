import { useEffect, useState } from 'react'
import type { GameMode } from '../engine/types'
import type { ClassicSeed } from '../engine/newgame'
import { ALL_DIVISIONS } from '../data/teams'
import { DIVISION_NAMES } from '../engine/types'
import { Window } from './common'

export interface HumanChoice {
  teamName: string | null // null = sortear na última divisão
  managerName: string
}

export function MainMenu({
  onNewGame,
  onContinue,
  hasSavedGame,
  onImport,
}: {
  onNewGame: (mode: GameMode, choices: HumanChoice[], classicSeeds?: ClassicSeed[]) => void
  onContinue: () => void
  hasSavedGame: boolean
  onImport: (json: string) => void
}) {
  const [mode, setMode] = useState<GameMode>('br2026')
  const [managers, setManagers] = useState<HumanChoice[]>([{ teamName: null, managerName: '' }])
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')

  // Dataset do modo Clássico 1998: opcional, carregado em tempo de execução.
  // Não faz parte do repositório público — se o arquivo não existir, o modo
  // simplesmente some do menu em vez de quebrar o jogo.
  const [classicSeeds, setClassicSeeds] = useState<ClassicSeed[] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/data/classic1998.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled) setClassicSeeds(data)
      })
      .catch(() => {
        if (!cancelled) setClassicSeeds(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const brTeams = ALL_DIVISIONS.flatMap((div, i) =>
    div.map((t) => ({ name: t.name, group: DIVISION_NAMES[i] })),
  )
  const classicTeams = (classicSeeds ?? [])
    .slice()
    .sort((a, b) => b.nivel_inicial - a.nivel_inicial)
    .map((t) => ({ name: t.nome_abreviado, group: `${t.pais} (nível ${t.nivel_inicial})` }))

  const effectiveMode = mode === 'classic1998' && !classicSeeds ? 'br2026' : mode
  const allTeams = effectiveMode === 'br2026' ? brTeams : classicTeams

  const valid =
    managers.every((m) => m.managerName.trim().length > 0) &&
    new Set(managers.filter((m) => m.teamName).map((m) => m.teamName)).size ===
      managers.filter((m) => m.teamName).length

  return (
    <div className="desktop">
      <div className="logo-title">⚽ ELIFOOT 98 WEB</div>
      <div className="logo-sub">Gerencie um clube do Brasileirão do zero à Série A e vença a Taça</div>

      <Window title="Novo Jogo">
        <div className="col">
          <div className="row">
            <b>Modo:</b>
            <label>
              <input type="radio" checked={effectiveMode === 'br2026'} onChange={() => setMode('br2026')} />{' '}
              🇧🇷 Brasileirão 2026 (80 clubes atuais, Séries A–D)
            </label>
            {classicSeeds && (
              <label>
                <input type="radio" checked={effectiveMode === 'classic1998'} onChange={() => setMode('classic1998')} />{' '}
                🕹️ Clássico Mundial 1998 (195 equipes, 4 divisões de 8 + Distrital)
              </label>
            )}
          </div>
          <p style={{ margin: '2px 0', fontSize: 12 }}>
            Deixe em "Sortear" para começar num clube da última divisão. Taça eliminatória com
            todas as equipes em ambos os modos.
          </p>
          {managers.map((m, idx) => (
            <div className="row" key={idx}>
              <label>Técnico {idx + 1}:</label>
              <input
                placeholder="Seu nome"
                value={m.managerName}
                onChange={(e) => {
                  const next = managers.slice()
                  next[idx] = { ...m, managerName: e.target.value }
                  setManagers(next)
                }}
              />
              <label>Clube:</label>
              <select
                value={m.teamName ?? '__SORTEIO__'}
                onChange={(e) => {
                  const next = managers.slice()
                  next[idx] = { ...m, teamName: e.target.value === '__SORTEIO__' ? null : e.target.value }
                  setManagers(next)
                }}
              >
                <option value="__SORTEIO__">🎲 Sortear (última divisão)</option>
                {allTeams.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.name} — {t.group}
                  </option>
                ))}
              </select>
              {managers.length > 1 && (
                <button onClick={() => setManagers(managers.filter((_, i) => i !== idx))}>Remover</button>
              )}
            </div>
          ))}
          <div className="row">
            {managers.length < 6 && (
              <button onClick={() => setManagers([...managers, { teamName: null, managerName: '' }])}>
                + Adicionar técnico (hot-seat, máx. 6)
              </button>
            )}
          </div>
          <div className="row">
            <button
              className="primary"
              disabled={!valid}
              onClick={() => onNewGame(effectiveMode, managers, classicSeeds ?? undefined)}
            >
              🏁 Começar carreira
            </button>
            {hasSavedGame && (
              <button className="primary" onClick={onContinue}>📂 Continuar jogo salvo</button>
            )}
            <button onClick={() => setShowImport(!showImport)}>📥 Importar save</button>
          </div>
          {showImport && (
            <div className="col">
              <textarea
                rows={5}
                style={{ width: '100%', fontFamily: 'monospace', fontSize: 11 }}
                placeholder="Cole aqui o JSON exportado"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="row">
                <button onClick={() => onImport(importText)}>Importar</button>
              </div>
            </div>
          )}
        </div>
      </Window>

      <Window title="Destaques do jogo">
        <ul style={{ margin: 4, paddingLeft: 20, fontSize: 12 }}>
          <li>Motor minuto a minuto com mando assimétrico (6000/6500/7000), anti-goleada e duelos individuais.</li>
          <li>Craques com `*` (+25% finalização/pênalti), comportamento Sarrafeiro→Fair play (cartões e preço).</li>
          <li>Taça mata-mata com pênaltis e final em campo neutro; prêmios 20M/6M/3M.</li>
          <li>Leilões que resolvem na rodada seguinte; pedidos de aumento quando o contrato zera.</li>
          <li>Moral 0–20; evolução ancorada à média do clube ±5; goleiros 50% mais lentos.</li>
          <li>Limites: 24 no elenco, mín. 11, máx. 5 estrangeiros (acordos de livre circulação não contam).</li>
          <li>Banco com juros de 5% do capital por jogo; inflação de 5% por época.</li>
          <li>Chicotada psicológica, convites, ranking e história do treinador; férias.</li>
        </ul>
      </Window>
    </div>
  )
}

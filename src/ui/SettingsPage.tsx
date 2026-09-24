import { useState } from 'react'
import { useSettings } from './common'
import { playGoal } from '../engine/sound'
import { SPEED_LABELS } from '../engine/settings'
import type { MatchSpeed } from '../engine/settings'
import { CALIBRATION_FIELDS, DEFAULT_CALIBRATION } from '../engine/calibration'
import type { Calibration } from '../engine/calibration'

export function SettingsPage() {
  const { settings, update } = useSettings()

  return (
    <div className="col">
      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="panel grow">
          <h3>🎨 Visual</h3>
          <div className="row">
            <label>Tema:</label>
            <label>
              <input
                type="radio"
                checked={settings.theme === 'retro'}
                onChange={() => update({ theme: 'retro' })}
              />{' '}
              Retrô 98 (clássico)
            </label>
            <label>
              <input
                type="radio"
                checked={settings.theme === 'modern'}
                onChange={() => update({ theme: 'modern' })}
              />{' '}
              Moderno 98 (clean)
            </label>
            <label>
              <input
                type="radio"
                checked={settings.theme === 'ultra'}
                onChange={() => update({ theme: 'ultra' })}
              />{' '}
              ⚡ Ultra (matchday 2026: dark, animado)
            </label>
          </div>
        </div>

        <div className="panel grow">
          <h3>⚽ Partida</h3>
          <div className="row">
            <label>Velocidade padrão:</label>
            <select
              value={settings.matchSpeed}
              onChange={(e) => update({ matchSpeed: e.target.value as MatchSpeed })}
            >
              {(Object.keys(SPEED_LABELS) as MatchSpeed[]).map((s) => (
                <option key={s} value={s}>{SPEED_LABELS[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="panel grow">
          <h3>🔊 Som</h3>
          <div className="row">
            <label>
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) => update({ sound: e.target.checked })}
              />{' '}
              Sons ativados (gol, apito, cartão…)
            </label>
            <button
              onClick={() => {
                if (settings.sound) playGoal()
              }}
              disabled={!settings.sound}
            >
              Testar som de gol
            </button>
          </div>
        </div>
      </div>

      <div className="row" style={{ alignItems: 'stretch' }}>
        <div className="panel grow">
          <h3>🛡️ Segurança</h3>
          <label>
            <input
              type="checkbox"
              checked={settings.confirmations}
              onChange={(e) => update({ confirmations: e.target.checked })}
            />{' '}
            Pedir confirmação em ações irreversíveis (rescisões, compras, empréstimos…)
          </label>
        </div>

        <div className="panel grow">
          <h3>⌨️ Atalhos de teclado</h3>
          <label>
            <input
              type="checkbox"
              checked={settings.showShortcutHints}
              onChange={(e) => update({ showShortcutHints: e.target.checked })}
            />{' '}
            Mostrar dicas de atalhos na barra de status
          </label>
          <table className="grid" style={{ marginTop: 8 }}>
            <tbody>
              <tr><td><b>1–9</b></td><td>Navegar entre as telas</td></tr>
              <tr><td><b>J</b></td><td>Jogar rodada</td></tr>
              <tr><td><b>Espaço</b></td><td>Pausar / continuar a partida</td></tr>
              <tr><td><b>1 / 2 / 3</b> (na partida)</td><td>Velocidade lenta / normal / rápida</td></tr>
              <tr><td><b>S</b> (na partida)</td><td>Abrir substituições</td></tr>
              <tr><td><b>F</b> (na partida)</td><td>Pular para o fim</td></tr>
              <tr><td><b>Enter</b></td><td>Continuar (fim de jogo / resultados)</td></tr>
              <tr><td><b>Esc</b></td><td>Fechar diálogos</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <CalibrationPanel settings={settings} update={update} />
    </div>
  )
}

function CalibrationPanel({
  settings,
  update,
}: {
  settings: ReturnType<typeof useSettings>['settings']
  update: ReturnType<typeof useSettings>['update']
}) {
  const [open, setOpen] = useState(false)
  const cal = settings.calibration

  const setField = (key: keyof Calibration, value: number) => {
    if (Number.isNaN(value)) return
    update({ calibration: { ...cal, [key]: value } })
  }

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>🎛️ Calibração do motor de partida</h3>
        <button onClick={() => setOpen((o) => !o)}>{open ? 'Ocultar ▲' : 'Mostrar ▼'}</button>
      </div>
      <p style={{ fontSize: 12, margin: '6px 0 0' }}>
        Controla a frequência de gols, cartões, pênaltis e lesões do motor de partida. Ajuste ao
        seu gosto; o efeito só aparece nas próximas partidas simuladas.
      </p>
      {open && (
        <>
          <div className="calib-grid">
            {CALIBRATION_FIELDS.map((f) => (
              <div className="calib-row" key={f.key}>
                <label htmlFor={`cal-${f.key}`}>
                  {f.label}
                  {f.unit ? ` (${f.unit})` : ''}
                </label>
                <input
                  id={`cal-${f.key}`}
                  type="range"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={cal[f.key]}
                  onChange={(e) => setField(f.key, Number(e.target.value))}
                />
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  step={f.step}
                  value={cal[f.key]}
                  onChange={(e) => setField(f.key, Number(e.target.value))}
                  style={{ width: 72 }}
                />
                <span className="calib-hint">{f.hint}</span>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={() => update({ calibration: { ...DEFAULT_CALIBRATION } })}>
              ↺ Restaurar todos os valores padrão
            </button>
          </div>
        </>
      )}
    </div>
  )
}

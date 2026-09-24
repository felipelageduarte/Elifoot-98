import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GameMode, GameState, MatchResult, RaiseRequest } from './engine/types'
import { playerDisplayName, BEHAVIOR_LABELS } from './engine/types'
import { createNewGame, createClassicGame } from './engine/newgame'
import type { ClassicSeed } from './engine/newgame'
import {
  startRound, finishRound, seasonFinished, endSeason, computeStandings, positionOf,
  currentEntry, entryLabel, resolveRaise, autoResolveRaises, acceptInvite, declineInvite, managerOf,
} from './engine/season'
import type { RoundReport, SeasonSummary, PendingHumanMatch } from './engine/season'
import { pendingLots, resolveLot } from './engine/auction'
import type { AuctionLot } from './engine/auction'
import { playerValue, canBuy } from './engine/transfers'
import { simulateMatch } from './engine/match'
import { drawReferee } from './engine/referees'
import { saveGame, loadGame, hasSave, exportSave, importSave, deleteSave } from './engine/save'
import { loadSettings, saveSettings } from './engine/settings'
import type { Settings } from './engine/settings'
import { setSoundEnabled } from './engine/sound'
import { setMatchCalibration } from './engine/match'

// aplica a calibração salva assim que o módulo carrega, antes de qualquer
// partida ser simulada (o efeito abaixo cobre mudanças feitas em runtime)
setMatchCalibration(loadSettings().calibration)
import { MainMenu } from './ui/MainMenu'
import type { HumanChoice } from './ui/MainMenu'
import { Office } from './ui/Office'
import { Squad } from './ui/Squad'
import { TablePage } from './ui/TablePage'
import { Fixtures } from './ui/Fixtures'
import { Transfers } from './ui/Transfers'
import { Finance } from './ui/Finance'
import { MatchLive } from './ui/MatchLive'
import { RoundResults } from './ui/RoundResults'
import { SettingsPage } from './ui/SettingsPage'
import { EditorPage } from './ui/EditorPage'
import { HistoryPage } from './ui/HistoryPage'
import { Window, Dialog, Money, fmtMoney, TeamChip, SettingsContext, useConfirm, MenuDropdown } from './ui/common'

type Screen = 'office' | 'squad' | 'table' | 'fixtures' | 'transfers' | 'finance' | 'history' | 'editor' | 'settings'

const SCREEN_KEYS: [string, Screen, string][] = [
  ['1', 'office', '🏢 Escritório'],
  ['2', 'squad', '👥 Elenco'],
  ['3', 'table', '📊 Classificação'],
  ['4', 'fixtures', '📅 Jogos e Taça'],
  ['5', 'transfers', '💱 Transferências'],
  ['6', 'finance', '💰 Finanças'],
  ['7', 'history', '🏆 Histórico'],
  ['8', 'editor', '🛠 Editor'],
  ['9', 'settings', '⚙️ Config'],
]
const SCREEN_LABEL = Object.fromEntries(SCREEN_KEYS.map(([, s, l]) => [s, l])) as Record<Screen, string>
const SCREEN_KEY_HINT = Object.fromEntries(SCREEN_KEYS.map(([k, s]) => [s, k])) as Record<Screen, string>

// Barra principal agrupada como no original (menus Campeonato / Elifoot
// eram dropdowns, não abas soltas) — evita quebra de linha com muitas telas.
const TOP_LEVEL_SCREENS: Screen[] = ['office', 'squad', 'transfers', 'finance', 'history']
const CAMPEONATO_SCREENS: Screen[] = ['table', 'fixtures']
const SISTEMA_SCREENS: Screen[] = ['editor', 'settings']

interface AuctionPhase {
  lots: AuctionLot[]
  lotIdx: number
  bidderIdx: number // índice em humanBidders do lote atual
  collected: { teamId: number; amount: number }[][]
  bidInput: number
  messages: string[]
}

interface RoundFlow {
  label: string
  humanMatches: PendingHumanMatch[]
  matchIdx: number
  humanResults: { result: MatchResult }[]
  report: RoundReport | null
  auctionMessages: string[]
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [state, setState] = useState<GameState | null>(null)
  const [screen, setScreen] = useState<Screen>('office')
  const [activeTeamId, setActiveTeamId] = useState<number>(0)
  const [auctionPhase, setAuctionPhase] = useState<AuctionPhase | null>(null)
  const [raiseQueue, setRaiseQueue] = useState<RaiseRequest[]>([])
  const [pendingAuctionMsgs, setPendingAuctionMsgs] = useState<string[]>([])
  const [flow, setFlow] = useState<RoundFlow | null>(null)
  const [invites, setInvites] = useState<{ managerName: string; teamId: number }[]>([])
  const [summary, setSummary] = useState<SeasonSummary | null>(null)
  const [, setTick] = useState(0)
  const confirm = useConfirm(settings)

  const settingsCtx = useMemo(
    () => ({
      settings,
      update: (patch: Partial<Settings>) => {
        setSettings((s) => {
          const next = { ...s, ...patch }
          saveSettings(next)
          return next
        })
      },
    }),
    [settings],
  )

  useEffect(() => { setSoundEnabled(settings.sound) }, [settings.sound])
  useEffect(() => { setMatchCalibration(settings.calibration) }, [settings.calibration])
  useEffect(() => {
    document.body.className =
      settings.theme === 'modern' ? 'theme-modern' : settings.theme === 'ultra' ? 'theme-ultra' : ''
  }, [settings.theme])

  const mutate = useCallback(
    (fn: () => void) => {
      fn()
      if (state) saveGame(state)
      setTick((t) => t + 1)
    },
    [state],
  )

  const startNewGame = (mode: GameMode, choices: HumanChoice[], classicSeeds?: ClassicSeed[]) => {
    const doStart = () => {
      const gs = mode === 'classic1998' && classicSeeds
        ? createClassicGame(classicSeeds, choices.map((c) => ({ managerName: c.managerName, teamName: c.teamName })))
        : createNewGame(choices.map((c) => ({ managerName: c.managerName, teamName: c.teamName })))
      setState(gs)
      setActiveTeamId(gs.humanTeamIds[0])
      setScreen('office')
      saveGame(gs)
    }
    if (hasSave()) {
      confirm.ask({
        title: 'Novo jogo',
        message: 'Começar um novo jogo APAGA o jogo salvo atual. Continuar?',
        danger: true,
        confirmLabel: 'Apagar e começar',
        action: doStart,
      })
    } else doStart()
  }

  const continueGame = () => {
    const gs = loadGame()
    if (gs) {
      setState(gs)
      setActiveTeamId(gs.humanTeamIds[0] ?? Object.values(gs.teams)[0].id)
      setScreen('office')
    } else {
      alert('O save é de uma versão antiga e não é compatível. Comece um novo jogo.')
      deleteSave()
      setTick((t) => t + 1)
    }
  }

  const handleImport = (json: string) => {
    const gs = importSave(json)
    if (gs) {
      setState(gs)
      setActiveTeamId(gs.humanTeamIds[0] ?? Object.values(gs.teams)[0].id)
      saveGame(gs)
    } else alert('JSON inválido ou de versão incompatível.')
  }

  // ---------- fluxo da rodada ----------

  // humanos elegíveis a ofertar num lote
  const humanBiddersFor = useCallback((gs: GameState, lot: AuctionLot): number[] => {
    return gs.humanTeamIds.filter((teamId) => {
      if (teamId === lot.seller.id) return false
      const team = gs.teams[teamId]
      const manager = managerOf(gs, teamId)
      if (!manager || manager.onVacation) return false
      if (manager.auctionPolicy === 'none') return false
      if (manager.auctionPolicy === 'strong') {
        const avg = team.players.reduce((s, p) => s + p.strength, 0) / Math.max(1, team.players.length)
        if (lot.player.strength < avg - 5) return false
      }
      return canBuy(team, lot.player) === null
    })
  }, [])

  const beginMatches = useCallback((gs: GameState, auctionMessages: string[]) => {
    const entry = currentEntry(gs)
    const label = entry ? entryLabel(gs, entry) : ''
    const { humanMatches } = startRound(gs)
    if (humanMatches.length === 0) {
      const report = finishRound(gs, [])
      report.auctionMessages = auctionMessages
      setFlow({ label, humanMatches: [], matchIdx: 0, humanResults: [], report, auctionMessages })
      setInvites(report.invites)
      saveGame(gs)
    } else {
      setFlow({ label, humanMatches, matchIdx: 0, humanResults: [], report: null, auctionMessages })
    }
    setTick((t) => t + 1)
  }, [])

  const beginRaises = useCallback((gs: GameState, auctionMessages: string[]) => {
    autoResolveRaises(gs, true)
    const humanRaises = gs.raiseRequests.filter((r) => {
      const team = gs.teams[r.teamId]
      const manager = managerOf(gs, r.teamId)
      return team?.isHuman && manager && !manager.onVacation && !manager.autoRaises
    })
    if (humanRaises.length > 0) {
      setPendingAuctionMsgs(auctionMessages)
      setRaiseQueue(humanRaises)
    } else {
      autoResolveRaises(gs, false)
      beginMatches(gs, auctionMessages)
    }
  }, [beginMatches])

  const handlePlayRound = useCallback(() => {
    if (!state || flow || auctionPhase || raiseQueue.length > 0) return
    if (seasonFinished(state)) {
      confirm.ask({
        title: 'Encerrar temporada',
        message: 'Encerrar a temporada aplica prêmios, acesso/rebaixamento, inflação e evolução. Irreversível. Continuar?',
        confirmLabel: 'Encerrar temporada',
        action: () => {
          const s = endSeason(state)
          setSummary(s)
          saveGame(state)
          setTick((t) => t + 1)
        },
      })
      return
    }

    // fase 1: leilões pendentes
    const lots = pendingLots(state)
    if (lots.length > 0) {
      const withHumans = lots.some((lot) => humanBiddersFor(state, lot).length > 0)
      if (withHumans) {
        setAuctionPhase({
          lots,
          lotIdx: 0,
          bidderIdx: 0,
          collected: lots.map(() => []),
          bidInput: 0,
          messages: [],
        })
        return
      }
      const messages = lots.map((lot) => resolveLot(state, lot, []).message)
      beginRaises(state, messages)
      return
    }
    beginRaises(state, [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, flow, auctionPhase, raiseQueue, settings.confirmations, humanBiddersFor, beginRaises])

  // avança a fase de leilão (oferta feita ou passada)
  const advanceAuction = (bid: { teamId: number; amount: number } | null) => {
    if (!state || !auctionPhase) return
    const phase = { ...auctionPhase }
    const lot = phase.lots[phase.lotIdx]
    const bidders = humanBiddersFor(state, lot)
    if (bid) phase.collected[phase.lotIdx] = [...phase.collected[phase.lotIdx], bid]
    phase.bidderIdx++
    if (phase.bidderIdx >= bidders.length) {
      // resolve o lote
      const res = resolveLot(state, lot, phase.collected[phase.lotIdx])
      phase.messages.push(res.message)
      phase.lotIdx++
      phase.bidderIdx = 0
      phase.bidInput = 0
      if (phase.lotIdx >= phase.lots.length) {
        setAuctionPhase(null)
        saveGame(state)
        beginRaises(state, phase.messages)
        return
      }
    }
    setAuctionPhase(phase)
  }

  const answerRaise = (req: RaiseRequest, accept: boolean) => {
    if (!state) return
    resolveRaise(state, req, accept)
    const rest = raiseQueue.filter((r) => r.playerId !== req.playerId)
    setRaiseQueue(rest)
    saveGame(state)
    if (rest.length === 0) {
      autoResolveRaises(state, false)
      beginMatches(state, pendingAuctionMsgs)
      setPendingAuctionMsgs([])
    }
  }

  const handleMatchFinished = (result: MatchResult) => {
    if (!state || !flow) return
    const humanResults = [...flow.humanResults, { result }]
    const matchIdx = flow.matchIdx + 1
    if (matchIdx >= flow.humanMatches.length) {
      const report = finishRound(state, humanResults)
      report.auctionMessages = flow.auctionMessages
      setInvites(report.invites)
      if (!state.humanTeamIds.includes(activeTeamId) && state.humanTeamIds.length > 0) {
        setActiveTeamId(state.humanTeamIds[0])
      }
      saveGame(state)
      setFlow({ ...flow, matchIdx, humanResults, report })
    } else {
      setFlow({ ...flow, matchIdx, humanResults })
    }
    setTick((t) => t + 1)
  }

  // atalhos globais
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (auctionPhase || raiseQueue.length > 0 || summary || invites.length > 0) return
      if (flow && !flow.report) return
      if (flow?.report) {
        if (e.key === 'Enter') setFlow(null)
        return
      }
      const hit = SCREEN_KEYS.find(([k]) => k === e.key)
      if (hit) setScreen(hit[1])
      else if (e.key.toLowerCase() === 'j') handlePlayRound()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, flow, auctionPhase, raiseQueue, summary, invites, handlePlayRound])

  if (!state) {
    return (
      <SettingsContext.Provider value={settingsCtx}>
        <MainMenu onNewGame={startNewGame} onContinue={continueGame} hasSavedGame={hasSave()} onImport={handleImport} />
        {confirm.dialog}
      </SettingsContext.Provider>
    )
  }

  if (state.humanTeamIds.length === 0 && !flow) {
    return (
      <SettingsContext.Provider value={settingsCtx}>
        <div className="desktop">
          <Window title="Fim de carreira">
            <h2>🚨 Chicotada psicológica!</h2>
            <p>Você foi despedido e nenhum clube o contratou. Fim de jogo.</p>
            <button className="primary" onClick={() => { deleteSave(); setState(null) }}>
              Voltar ao menu
            </button>
          </Window>
        </div>
      </SettingsContext.Provider>
    )
  }

  const team = state.teams[activeTeamId]
  const division = state.divisions.find((d) => d.level === team.division)
  const standings = division ? computeStandings(state, division) : []
  const seasonOver = seasonFinished(state)

  // ---------- fase de leilão (diálogo) ----------
  if (auctionPhase) {
    const lot = auctionPhase.lots[auctionPhase.lotIdx]
    const bidders = humanBiddersFor(state, lot)
    const bidderTeamId = bidders[auctionPhase.bidderIdx]
    const bidderTeam = bidderTeamId !== undefined ? state.teams[bidderTeamId] : null
    return (
      <SettingsContext.Provider value={settingsCtx}>
        <div className="desktop">
          <Window title={`🔨 Venda de jogador por leilão (${auctionPhase.lotIdx + 1}/${auctionPhase.lots.length})`}>
            <div className="col">
              <div className="panel">
                <h3>{playerDisplayName(lot.player)} — {lot.seller.name}</h3>
                <div className="row" style={{ gap: 16 }}>
                  <span>Posição: <b>{lot.player.pos}</b></span>
                  <span>Força: <b>{lot.player.strength}</b></span>
                  <span>Idade: {lot.player.age}</span>
                  <span>País: {lot.player.nationality}</span>
                  <span>Comportamento: {BEHAVIOR_LABELS[lot.player.behavior]}</span>
                  <span>Gols na época: {lot.player.goals}</span>
                </div>
                <p>
                  Lance mínimo: <Money value={lot.auction.minPrice} /> · Valor de mercado:{' '}
                  <Money value={playerValue(lot.player, undefined, state.inflation)} />
                </p>
              </div>
              {bidderTeam ? (
                <div className="panel inset-gray">
                  <h3>{bidderTeam.managerName} ({bidderTeam.name}) — sua oferta</h3>
                  <p>Dinheiro em caixa: <Money value={bidderTeam.cash} /></p>
                  <div className="row">
                    <input
                      type="number"
                      value={auctionPhase.bidInput}
                      step={50000}
                      min={0}
                      style={{ width: 150 }}
                      onChange={(e) => setAuctionPhase({ ...auctionPhase, bidInput: Number(e.target.value) })}
                    />
                    <button
                      className="primary"
                      disabled={auctionPhase.bidInput < lot.auction.minPrice || auctionPhase.bidInput > bidderTeam.cash}
                      onClick={() => advanceAuction({ teamId: bidderTeam.id, amount: auctionPhase.bidInput })}
                    >
                      Ofertar {fmtMoney(auctionPhase.bidInput)}
                    </button>
                    <button onClick={() => advanceAuction(null)}>Não quero ofertar</button>
                  </div>
                  <p style={{ fontSize: 11 }}>Os clubes do computador também darão lances. Ganha a maior oferta.</p>
                </div>
              ) : (
                <button className="primary" onClick={() => advanceAuction(null)}>Prosseguir</button>
              )}
            </div>
          </Window>
        </div>
      </SettingsContext.Provider>
    )
  }

  // ---------- fase de pedidos de aumento ----------
  if (raiseQueue.length > 0) {
    const req = raiseQueue[0]
    const reqTeam = state.teams[req.teamId]
    const player = reqTeam?.players.find((p) => p.id === req.playerId)
    if (!reqTeam || !player) {
      setRaiseQueue(raiseQueue.slice(1))
      return null
    }
    return (
      <SettingsContext.Provider value={settingsCtx}>
        <div className="desktop">
          <Window title="💰 Actualização de Salário">
            <div className="col">
              <p>
                <b>{reqTeam.managerName}</b>: o contrato de <b>{playerDisplayName(player)}</b> ({reqTeam.name}) terminou.
              </p>
              <p>
                {player.name} pede aumento para <b>{fmtMoney(req.demandedSalary)}</b>/jogo (atual:{' '}
                {fmtMoney(player.salary)}).
              </p>
              {req.mandatory ? (
                <>
                  <p style={{ color: 'red' }}>Uma vez que este jogador não pode ser vendido, tem de aceitar o aumento.</p>
                  <div className="row">
                    <button className="primary" onClick={() => answerRaise(req, true)}>OK, aceitar</button>
                  </div>
                </>
              ) : (
                <>
                  <p>Se não aceitar o aumento, o jogador será posto à venda em leilão.</p>
                  <div className="row">
                    <button className="primary" onClick={() => answerRaise(req, true)}>Sim, aceitar aumento</button>
                    <button onClick={() => answerRaise(req, false)}>Não — vender em leilão</button>
                  </div>
                </>
              )}
            </div>
          </Window>
        </div>
      </SettingsContext.Provider>
    )
  }

  // ---------- fase de partidas / resultados ----------
  if (flow) {
    const current = flow.report ? null : flow.humanMatches[flow.matchIdx]
    return (
      <SettingsContext.Provider value={settingsCtx}>
        <div className="desktop">
          <Window title={`Elifoot 98 Web — ${flow.label}, Temporada ${state.season}`}>
            {current ? (
              <MatchLive
                key={`${current.homeId}-${current.awayId}`}
                state={state}
                match={current}
                onFinished={handleMatchFinished}
              />
            ) : (
              <RoundResults
                state={state}
                report={flow.report!}
                activeTeamId={activeTeamId}
                label={flow.label}
                onDone={() => setFlow(null)}
              />
            )}
          </Window>
        </div>
      </SettingsContext.Provider>
    )
  }

  return (
    <SettingsContext.Provider value={settingsCtx}>
      <div className="desktop">
        <Window title={`Elifoot 98 Web — ${team.name} — Temporada ${state.season} (época ${state.seasonNumber})`}>
          <div className="menubar">
            {TOP_LEVEL_SCREENS.map((scr) => (
              <button
                key={scr}
                className={screen === scr ? 'active' : ''}
                title={`Atalho: ${SCREEN_KEY_HINT[scr]}`}
                onClick={() => setScreen(scr)}
              >
                {SCREEN_LABEL[scr]}
              </button>
            ))}
            <MenuDropdown label="📊 Campeonato" active={CAMPEONATO_SCREENS.includes(screen)}>
              {CAMPEONATO_SCREENS.map((scr) => (
                <button
                  key={scr}
                  className={screen === scr ? 'active' : ''}
                  title={`Atalho: ${SCREEN_KEY_HINT[scr]}`}
                  onClick={() => setScreen(scr)}
                >
                  {SCREEN_LABEL[scr]}
                </button>
              ))}
            </MenuDropdown>
            <MenuDropdown label="☰ Sistema" active={SISTEMA_SCREENS.includes(screen)}>
              {SISTEMA_SCREENS.map((scr) => (
                <button
                  key={scr}
                  className={screen === scr ? 'active' : ''}
                  title={`Atalho: ${SCREEN_KEY_HINT[scr]}`}
                  onClick={() => setScreen(scr)}
                >
                  {SCREEN_LABEL[scr]}
                </button>
              ))}
              <div className="menu-dropdown-sep" />
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(exportSave(state))
                  alert('Save copiado para a área de transferência!')
                }}
              >
                📤 Exportar save
              </button>
              <button
                onClick={() =>
                  confirm.ask({
                    title: 'Sair para o menu',
                    message: 'Sair para o menu? O jogo fica salvo automaticamente.',
                    confirmLabel: 'Sair',
                    action: () => setState(null),
                  })
                }
              >
                🚪 Sair para o menu
              </button>
            </MenuDropdown>
            <span className="grow" />
            {state.humanTeamIds.length > 1 && (
              <select value={activeTeamId} onChange={(e) => setActiveTeamId(Number(e.target.value))}>
                {state.humanTeamIds.map((id) => (
                  <option key={id} value={id}>
                    {state.teams[id].name} ({state.teams[id].managerName})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="window-body" key={screen}>
            {screen === 'office' && <Office state={state} team={team} onPlayRound={handlePlayRound} seasonOver={seasonOver} />}
            {screen === 'squad' && <Squad state={state} team={team} mutate={mutate} />}
            {screen === 'table' && <TablePage state={state} activeTeamId={activeTeamId} />}
            {screen === 'fixtures' && <Fixtures state={state} activeTeamId={activeTeamId} />}
            {screen === 'transfers' && <Transfers state={state} team={team} mutate={mutate} />}
            {screen === 'finance' && <Finance state={state} team={team} mutate={mutate} />}
            {screen === 'history' && <HistoryPage state={state} activeTeamId={activeTeamId} mutate={mutate} />}
            {screen === 'editor' && <EditorPage state={state} mutate={mutate} />}
            {screen === 'settings' && <SettingsPage />}
          </div>

          <div className="statusbar">
            <span className="cell"><TeamChip colors={team.colors} /> {team.name}</span>
            <span className="cell">Caixa: <Money value={team.cash} /></span>
            {division && <span className="cell">{positionOf(standings, team.id)}º lugar</span>}
            <span className="cell">Moral {team.moral}/20</span>
            <span className="cell">
              Jornada {Math.min(state.currentMatchday + 1, state.calendar.length)}/{state.calendar.length}
            </span>
            {settings.showShortcutHints && (
              <span className="cell grow" style={{ textAlign: 'right' }}>⌨️ 1-9 telas · J jogar · Esc fecha</span>
            )}
          </div>
        </Window>

        {invites.length > 0 && (
          <Dialog title="✉️ Convite" onClose={() => { invites.forEach((i) => declineInvite(state, i.teamId)); setInvites([]) }}>
            {invites.map((inv, i) => (
              <div className="panel" key={i} style={{ marginBottom: 6 }}>
                <p style={{ fontSize: 15 }}>
                  <b>{inv.managerName}</b>, quer vir treinar o <b>{state.teams[inv.teamId].name}</b>{' '}
                  ({state.teams[inv.teamId].division <= 4 ? state.divisions.find((d) => d.level === state.teams[inv.teamId].division)?.name : 'Distrital'})?
                </p>
                <div className="row">
                  <button
                    className="primary"
                    onClick={() => {
                      mutate(() => {
                        const msg = acceptInvite(state, inv.managerName, inv.teamId)
                        state.news.unshift({ round: state.currentMatchday, season: state.season, text: `✉️ ${msg}` })
                        const m = state.managers.find((x) => x.name === inv.managerName)
                        if (m?.teamId) setActiveTeamId(m.teamId)
                      })
                      setInvites(invites.filter((_, j) => j !== i))
                    }}
                  >
                    Sim, aceitar
                  </button>
                  <button
                    onClick={() => {
                      mutate(() => declineInvite(state, inv.teamId))
                      setInvites(invites.filter((_, j) => j !== i))
                    }}
                  >
                    Não, obrigado
                  </button>
                </div>
              </div>
            ))}
          </Dialog>
        )}

        {summary && (
          <Dialog title={`🏆 Fim de Época ${state.season - 1}`} onClose={() => setSummary(null)}>
            <h3>Campeões</h3>
            <ul>
              {summary.champions.map((c, i) => (
                <li key={i}><b>{c.division}:</b> {c.teamName}</li>
              ))}
              <li><b>Taça:</b> 🏆 {summary.cupWinner}</li>
            </ul>
            <h3>Melhores marcadores</h3>
            <ol>
              {summary.topScorers.map((s, i) => (
                <li key={i}><b>{s.name}</b> ({s.team}) — {s.goals} gols</li>
              ))}
            </ol>
            <h3>Acesso</h3>
            <ul>{summary.promoted.map((s, i) => (<li key={i}>⬆️ {s}</li>))}</ul>
            <h3>Rebaixamento</h3>
            <ul>{summary.relegated.map((s, i) => (<li key={i}>⬇️ {s}</li>))}</ul>
            <button className="primary" onClick={() => setSummary(null)}>
              Começar temporada {state.season} ▶
            </button>
          </Dialog>
        )}

        {confirm.dialog}
      </div>
    </SettingsContext.Provider>
  )
}

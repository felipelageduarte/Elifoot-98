import { useState } from 'react'
import type { GameState, Team } from '../engine/types'
import {
  computeBudget, computeDre, expandStadium, LEDGER_LABELS, loanInterest, maxLoan, borrow, repay,
  stadiumExpansionCost, weeklyWages, STADIUM_STEP, LOAN_STEP,
} from '../engine/finance'
import { Money, fmtMoney, useConfirm } from './common'

type Tab = 'resumo' | 'dre' | 'orcamento' | 'extrato'

export function Finance({
  state,
  team,
  mutate,
}: {
  state: GameState
  team: Team
  mutate: (fn: () => void) => void
}) {
  const [tab, setTab] = useState<Tab>('resumo')
  const [message, setMessage] = useState('')
  const confirm = useConfirm()

  const entries = (team.ledger ?? []).filter((e) => e.season === state.season)
  const dre = computeDre(entries)
  const budget = computeBudget(state, team)

  return (
    <div className="col">
      <div className="row">
        <button className={tab === 'resumo' ? 'primary' : ''} onClick={() => setTab('resumo')}>💰 Resumo e ações</button>
        <button className={tab === 'dre' ? 'primary' : ''} onClick={() => setTab('dre')}>📊 DRE da temporada</button>
        <button className={tab === 'orcamento' ? 'primary' : ''} onClick={() => setTab('orcamento')}>📈 Orçamento</button>
        <button className={tab === 'extrato' ? 'primary' : ''} onClick={() => setTab('extrato')}>🧾 Extrato</button>
        <span className="grow" />
        <span style={{ fontSize: 12 }}>Inflação acumulada: ×{state.inflation.toFixed(2)}</span>
      </div>

      {message && (
        <div className="panel inset-gray">
          {message} <button onClick={() => setMessage('')}>OK</button>
        </div>
      )}

      {tab === 'resumo' && (
        <div className="row" style={{ alignItems: 'stretch' }}>
          <div className="panel grow">
            <h3>💰 Situação</h3>
            <p>Caixa: <Money value={team.cash} /></p>
            <p>Folha salarial por jogo: <Money value={-weeklyWages(team)} /></p>
            <p>Moral do time: <b>{team.moral}/20</b> {team.cash < 0 && <span style={{ color: 'red' }}>(caixa negativo derruba a moral!)</span>}</p>
            <p>Preço do ingresso: <b>${team.ticketPrice}</b></p>
            <div className="row">
              <label>Ajustar ingresso:</label>
              <button onClick={() => mutate(() => { team.ticketPrice = Math.max(1, team.ticketPrice - 5) })}>-5</button>
              <button onClick={() => mutate(() => { team.ticketPrice = Math.max(1, team.ticketPrice - 1) })}>-1</button>
              <button onClick={() => mutate(() => { team.ticketPrice += 1 })}>+1</button>
              <button onClick={() => mutate(() => { team.ticketPrice += 5 })}>+5</button>
            </div>
            <p style={{ fontSize: 12 }}>⚠️ O público depende da força das DUAS equipes e do preço. Adversário forte = casa cheia.</p>
          </div>

          <div className="panel grow">
            <h3>🏦 Banco</h3>
            <p>Capital em dívida: <Money value={-(team.loan?.amount ?? 0)} /></p>
            <p>Juros: <b>5% do capital por jogo</b> = <Money value={-loanInterest(team)} /> por rodada</p>
            <p>Confiança do banco (limite): <Money value={maxLoan(state, team)} /></p>
            <div className="row">
              <button
                onClick={() =>
                  confirm.ask({
                    title: 'Pedir empréstimo',
                    message: (
                      <span>
                        Pedir <b>{fmtMoney(LOAN_STEP)}</b> ao banco? Os juros são de 5% do capital em dívida a
                        cada jogo, até você amortizar.
                      </span>
                    ),
                    confirmLabel: 'Pedir 100 mil',
                    action: () => mutate(() => setMessage(borrow(state, team))),
                  })
                }
              >
                Pedir 100 mil
              </button>
              <button onClick={() => mutate(() => setMessage(repay(state, team)))}>Pagar 100 mil</button>
            </div>
            <p style={{ fontSize: 12 }}>💡 Conselho dos veteranos: 5% por jogo afunda o clube. Evite.</p>
          </div>

          <div className="panel grow">
            <h3>🏟️ Estádio</h3>
            <p>Capacidade: <b>{team.stadiumCapacity.toLocaleString('pt-BR')}</b> lugares</p>
            <p>Torcida estimada: <b>{team.fanCount.toLocaleString('pt-BR')}</b></p>
            <button
              onClick={() =>
                confirm.ask({
                  title: 'Ampliar estádio',
                  message: (
                    <span>
                      Construir bancada de {STADIUM_STEP.toLocaleString('pt-BR')} lugares por{' '}
                      <b>{fmtMoney(stadiumExpansionCost(state))}</b>? O valor sai do caixa imediatamente.
                    </span>
                  ),
                  confirmLabel: 'Construir',
                  action: () => mutate(() => setMessage(expandStadium(state, team))),
                })
              }
            >
              Construir +{STADIUM_STEP.toLocaleString('pt-BR')} lugares ({fmtMoney(stadiumExpansionCost(state))})
            </button>
            <p style={{ fontSize: 12 }}>💡 Torcida lotada não intimida ninguém — estádio é puro dinheiro.</p>
          </div>
        </div>
      )}

      {tab === 'dre' && (
        <div className="panel">
          <h3>📊 Demonstração de Resultado — Temporada {state.season}</h3>
          <table className="grid">
            <tbody>
              <tr className="dre-sec-rev"><td colSpan={2}><b>RECEITAS OPERACIONAIS</b></td></tr>
              {dre.revenues.map((l) => (
                <tr key={l.cat}><td style={{ paddingLeft: 20 }}>{l.label}</td><td style={{ textAlign: 'right' }}><Money value={l.total} /></td></tr>
              ))}
              <tr><td><b>Total de receitas</b></td><td style={{ textAlign: 'right' }}><Money value={dre.totalRevenue} /></td></tr>
              <tr className="dre-sec-exp"><td colSpan={2}><b>DESPESAS OPERACIONAIS</b></td></tr>
              {dre.expenses.map((l) => (
                <tr key={l.cat}><td style={{ paddingLeft: 20 }}>{l.label}</td><td style={{ textAlign: 'right' }}><Money value={l.total} /></td></tr>
              ))}
              <tr><td><b>Total de despesas</b></td><td style={{ textAlign: 'right' }}><Money value={dre.totalExpense} /></td></tr>
              <tr className={dre.result >= 0 ? 'dre-pos' : 'dre-neg'}>
                <td><b>RESULTADO OPERACIONAL</b></td>
                <td style={{ textAlign: 'right' }}><b><Money value={dre.result} /></b></td>
              </tr>
              {dre.financing.length > 0 && (
                <>
                  <tr className="dre-sec-fin"><td colSpan={2}><b>ATIVIDADES DE FINANCIAMENTO</b></td></tr>
                  {dre.financing.map((l) => (
                    <tr key={l.cat}><td style={{ paddingLeft: 20 }}>{l.label}</td><td style={{ textAlign: 'right' }}><Money value={l.total} /></td></tr>
                  ))}
                  <tr><td><b>Resultado de financiamento</b></td><td style={{ textAlign: 'right' }}><Money value={dre.totalFinancing} /></td></tr>
                </>
              )}
              <tr className="dre-cash">
                <td><b>VARIAÇÃO DE CAIXA NA TEMPORADA</b></td>
                <td style={{ textAlign: 'right' }}><b><Money value={dre.result + dre.totalFinancing} /></b></td>
              </tr>
            </tbody>
          </table>
          {entries.length === 0 && <p>Nenhum lançamento registrado ainda nesta temporada.</p>}
        </div>
      )}

      {tab === 'orcamento' && (
        <div className="panel">
          <h3>📈 Orçamento — projeção até o fim da temporada</h3>
          <table className="grid">
            <tbody>
              <tr><td>Caixa atual</td><td style={{ textAlign: 'right' }}><Money value={team.cash} /></td></tr>
              <tr><td>Jornadas restantes: <b>{budget.roundsLeft}</b> ({budget.homeGamesLeft} em casa no campeonato)</td><td></td></tr>
              <tr><td>Receita projetada de bilheteria (média {fmtMoney(budget.avgGate)}/jogo)</td><td style={{ textAlign: 'right' }}><Money value={budget.projectedGate} /></td></tr>
              <tr><td>Folha salarial projetada ({fmtMoney(weeklyWages(team))}/jogo)</td><td style={{ textAlign: 'right' }}><Money value={budget.projectedWages} /></td></tr>
              {budget.projectedLoanPayments !== 0 && (
                <tr><td>Juros de empréstimo projetados</td><td style={{ textAlign: 'right' }}><Money value={budget.projectedLoanPayments} /></td></tr>
              )}
              <tr className={budget.projectedBalance >= 0 ? 'dre-pos' : 'dre-neg'}>
                <td><b>SALDO PROJETADO NO FIM DA TEMPORADA</b></td>
                <td style={{ textAlign: 'right' }}><b><Money value={budget.projectedBalance} /></b></td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 12 }}>
            Não inclui prêmios (campeão {fmtMoney(20000000)}, taça {fmtMoney(6000000)}, artilheiro {fmtMoney(3000000)}),
            transferências nem obras. Dívida de 3× a folha por 3 rodadas ou 5 derrotas seguidas = chicotada psicológica.
          </p>
        </div>
      )}

      {tab === 'extrato' && (
        <div className="panel">
          <h3>🧾 Extrato — últimos lançamentos</h3>
          <table className="grid">
            <thead>
              <tr><th>Rodada</th><th>Categoria</th><th>Descrição</th><th style={{ textAlign: 'right' }}>Valor</th></tr>
            </thead>
            <tbody>
              {(team.ledger ?? []).slice().reverse().slice(0, 40).map((e, i) => (
                <tr key={i}>
                  <td>T{e.season} R{e.round}</td>
                  <td>{LEDGER_LABELS[e.cat]}</td>
                  <td>{e.desc}</td>
                  <td style={{ textAlign: 'right' }}><Money value={e.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {(team.ledger ?? []).length === 0 && <p>Nenhum lançamento ainda.</p>}
        </div>
      )}

      {confirm.dialog}
    </div>
  )
}

# ⚽ Elifoot 98 Web

Jogo de gerenciamento de futebol para navegador, no espírito dos clássicos jogos de gestão dos anos 90: escolha um clube do Brasileirão (Séries A a D), monte o time, dispute o campeonato e a Taça, negocie no mercado de transferências e administre as finanças do clube ao longo de várias temporadas.

100% front-end — roda inteiramente no navegador, sem servidor, com o progresso salvo automaticamente no `localStorage`.

📖 **[Documentação completa (motor de jogo, fórmulas, telas)](https://felipelageduarte.github.io/Elifoot-98/)**

## Como rodar

```bash
npm install
npm run dev      # http://localhost:5173
```

Build de produção (gera `dist/`, funciona como site estático):

```bash
npm run build
npm run preview
```

Testes do motor de jogo:

```bash
npm test
```

## Funcionalidades

### Competições
- **Brasileirão 2026**: 4 divisões (Séries A, B, C, D) de 20 clubes cada, pontos corridos, acesso e rebaixamento (4 sobem e 4 descem por divisão) — modo padrão, incluído no repositório
- **Clássico Mundial 1998** (opcional): 4 divisões de 8 clubes + Distrital, carregado em tempo de execução a partir de um dataset local não incluído neste repositório — sem ele, essa opção simplesmente não aparece no menu e o resto do jogo funciona normalmente
- **Taça** eliminatória de jogo único com todas as equipes de todas as divisões: pré-eliminatória quando o número de times não é potência de 2, disputa por pênaltis no empate, final em campo neutro com a renda dividida
- Prêmios por temporada: campeão (escalonado por divisão), vencedor da Taça, artilheiro do campeonato

### Motor de partida
- Simulação minuto a minuto (1–90 min) com força de ataque/defesa por setor, mando de campo assimétrico (casa/fora/campo neutro) e um gerador anti-goleada que evita placares elásticos
- Duelos individuais entre atacante e defensor decidem cada chance antes do chute a gol
- Desfechos variados: gol, defesa, travessão, poste, chute para fora ou por cima
- Pênaltis em jogo (o técnico humano escolhe o cobrador) e disputa por pênaltis na Taça
- Árbitros com nível de rigor próprio, cartões por uma "roleta" de comportamento do jogador (de muito agressivo a fair play) e lesões com chance de queda de força e substituição
- Até 3 substituições por partida, 6 velocidades de simulação e pausa a qualquer momento

### Elenco e mercado
- Jogadores "craque" (≈30% de meias e atacantes) com bônus de finalização, cobrança de pênalti e valor de mercado
- Leilões que resolvem na rodada seguinte, com lances de outros clubes controlados pela IA e do próprio jogador
- Pedidos de renovação de contrato quando ele se aproxima do fim; recusar manda o jogador a leilão automaticamente
- Limite de 24 jogadores por elenco (mínimo 11) e no máximo 5 estrangeiros por clube, com exceções para blocos de livre circulação entre países
- Compra direta, agentes livres, observação de clubes rivais e histórico de transferências
- Evolução de força pós-jogo ancorada à média do elenco, moral do time (0–20) influenciada por resultados e situação financeira

### Carreira do treinador
- Ranking de treinadores por pontos (vitória fora vale mais que em casa), títulos de campeonato e de Taça
- Demissão após sequência de derrotas ou dívida persistente, com convites de outros clubes para técnicos disponíveis
- Modo férias (a IA assume o clube temporariamente) e histórico de carreira por temporada

### Finanças
- Bilheteria calculada pela força média dos dois times e pelo preço do ingresso
- Empréstimo bancário com juros por partida e limite de crédito baseado na saúde financeira do clube
- Inflação anual que reajusta salários, preços e prêmios
- Demonstração de resultado (DRE) da temporada, orçamento com projeção de caixa e extrato financeiro completo
- Ampliação de estádio em lotes de bancadas

### Interface
- 12 formações táticas + escalação automática (testa todas e escolhe a mais forte) e escalação "melhores disponíveis"
- Painel de calibração do motor de partida: o jogador pode ajustar a frequência de gols, cartões, pênaltis e lesões ao seu gosto
- Painel de estatísticas agregadas da carreira (gols por jogo, % de vitórias em casa/fora, cartões, pênaltis, lesões)
- 3 temas visuais, sons de partida, atalhos de teclado completos e confirmações antes de ações irreversíveis

## Aviso legal

Este é um projeto de fã, feito de forma independente para fins de estudo e entretenimento. O código e os dados incluídos neste repositório (motor de jogo, clubes brasileiros e suas divisões) são criação própria ou informação pública genérica — nada aqui foi extraído de qualquer jogo comercial. O modo "Clássico Mundial 1998" mencionado acima é opcional e depende de um dataset mantido fora deste repositório, por conta própria do usuário; o nome "Elifoot 98" é usado apenas como referência de gênero/estilo de jogo, sem qualquer afiliação, endosso ou vínculo com os detentores de direitos do jogo original.

## Stack

Vite + React + TypeScript. Sem backend — tudo roda no navegador.

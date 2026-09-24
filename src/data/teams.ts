import type { Position } from '../engine/types'

export interface StarPlayer {
  name: string
  pos: Position
  strength: number
  nat: string
}

export interface ClubSeed {
  name: string
  short: string
  colors: [string, string]
  capacity: number
  fans: number // torcida base (milhares) — só afeta renda, como no original
  stars?: StarPlayer[]
}

// Divisões do Campeonato Brasileiro — temporada base 2026
// Série A
export const SERIE_A: ClubSeed[] = [
  {
    name: 'Flamengo', short: 'FLA', colors: ['#C52613', '#000000'], capacity: 78000, fans: 900,
    stars: [
      { name: 'Rossi', pos: 'G', strength: 44, nat: 'ARG' },
      { name: 'Arrascaeta', pos: 'M', strength: 47, nat: 'URU' },
      { name: 'Pedro', pos: 'A', strength: 46, nat: 'BRA' },
      { name: 'De la Cruz', pos: 'M', strength: 44, nat: 'URU' },
      { name: 'Léo Pereira', pos: 'D', strength: 43, nat: 'BRA' },
    ],
  },
  {
    name: 'Palmeiras', short: 'PAL', colors: ['#006437', '#FFFFFF'], capacity: 43000, fans: 700,
    stars: [
      { name: 'Weverton', pos: 'G', strength: 43, nat: 'BRA' },
      { name: 'Gustavo Gómez', pos: 'D', strength: 45, nat: 'PAR' },
      { name: 'Raphael Veiga', pos: 'M', strength: 44, nat: 'BRA' },
      { name: 'Flaco López', pos: 'A', strength: 44, nat: 'ARG' },
      { name: 'Piquerez', pos: 'D', strength: 42, nat: 'URU' },
    ],
  },
  {
    name: 'Cruzeiro', short: 'CRU', colors: ['#003DA5', '#FFFFFF'], capacity: 61000, fans: 500,
    stars: [
      { name: 'Cássio', pos: 'G', strength: 42, nat: 'BRA' },
      { name: 'Matheus Pereira', pos: 'M', strength: 44, nat: 'BRA' },
      { name: 'Kaio Jorge', pos: 'A', strength: 44, nat: 'BRA' },
      { name: 'Lucas Romero', pos: 'M', strength: 40, nat: 'ARG' },
    ],
  },
  {
    name: 'Botafogo', short: 'BOT', colors: ['#000000', '#FFFFFF'], capacity: 46000, fans: 350,
    stars: [
      { name: 'John', pos: 'G', strength: 43, nat: 'BRA' },
      { name: 'Savarino', pos: 'M', strength: 43, nat: 'VEN' },
      { name: 'Alex Telles', pos: 'D', strength: 42, nat: 'BRA' },
      { name: 'Artur', pos: 'A', strength: 41, nat: 'BRA' },
    ],
  },
  {
    name: 'São Paulo', short: 'SAO', colors: ['#FF0000', '#000000'], capacity: 66000, fans: 650,
    stars: [
      { name: 'Rafael', pos: 'G', strength: 42, nat: 'BRA' },
      { name: 'Lucas Moura', pos: 'M', strength: 43, nat: 'BRA' },
      { name: 'Luciano', pos: 'A', strength: 42, nat: 'BRA' },
      { name: 'Arboleda', pos: 'D', strength: 41, nat: 'EQU' },
    ],
  },
  {
    name: 'Fluminense', short: 'FLU', colors: ['#870A28', '#00613C'], capacity: 78000, fans: 400,
    stars: [
      { name: 'Fábio', pos: 'G', strength: 42, nat: 'BRA' },
      { name: 'Thiago Silva', pos: 'D', strength: 44, nat: 'BRA' },
      { name: 'Ganso', pos: 'M', strength: 41, nat: 'BRA' },
      { name: 'Cano', pos: 'A', strength: 42, nat: 'ARG' },
    ],
  },
  {
    name: 'Corinthians', short: 'COR', colors: ['#000000', '#FFFFFF'], capacity: 49000, fans: 800,
    stars: [
      { name: 'Hugo Souza', pos: 'G', strength: 43, nat: 'BRA' },
      { name: 'Rodrigo Garro', pos: 'M', strength: 43, nat: 'ARG' },
      { name: 'Yuri Alberto', pos: 'A', strength: 43, nat: 'BRA' },
      { name: 'Memphis Depay', pos: 'A', strength: 45, nat: 'HOL' },
    ],
  },
  {
    name: 'Bahia', short: 'BAH', colors: ['#0066B3', '#EE1C25'], capacity: 48000, fans: 350,
    stars: [
      { name: 'Everton Ribeiro', pos: 'M', strength: 42, nat: 'BRA' },
      { name: 'Jean Lucas', pos: 'M', strength: 41, nat: 'BRA' },
      { name: 'Luciano Juba', pos: 'D', strength: 40, nat: 'BRA' },
    ],
  },
  {
    name: 'Grêmio', short: 'GRE', colors: ['#0D80BF', '#000000'], capacity: 55000, fans: 450,
    stars: [
      { name: 'Braithwaite', pos: 'A', strength: 43, nat: 'DIN' },
      { name: 'Villasanti', pos: 'M', strength: 42, nat: 'PAR' },
      { name: 'Kannemann', pos: 'D', strength: 40, nat: 'ARG' },
    ],
  },
  {
    name: 'Atlético-MG', short: 'CAM', colors: ['#000000', '#FFFFFF'], capacity: 46000, fans: 450,
    stars: [
      { name: 'Everson', pos: 'G', strength: 42, nat: 'BRA' },
      { name: 'Hulk', pos: 'A', strength: 44, nat: 'BRA' },
      { name: 'Gustavo Scarpa', pos: 'M', strength: 42, nat: 'BRA' },
    ],
  },
  {
    name: 'Internacional', short: 'INT', colors: ['#E5050F', '#FFFFFF'], capacity: 50000, fans: 450,
    stars: [
      { name: 'Rochet', pos: 'G', strength: 42, nat: 'URU' },
      { name: 'Alan Patrick', pos: 'M', strength: 43, nat: 'BRA' },
      { name: 'Borré', pos: 'A', strength: 42, nat: 'COL' },
    ],
  },
  {
    name: 'Santos', short: 'SAN', colors: ['#FFFFFF', '#000000'], capacity: 16000, fans: 400,
    stars: [
      { name: 'Neymar', pos: 'A', strength: 47, nat: 'BRA' },
      { name: 'Gabriel Brazão', pos: 'G', strength: 41, nat: 'BRA' },
      { name: 'Zé Rafael', pos: 'M', strength: 40, nat: 'BRA' },
    ],
  },
  {
    name: 'Vasco da Gama', short: 'VAS', colors: ['#000000', '#FFFFFF'], capacity: 21000, fans: 500,
    stars: [
      { name: 'Léo Jardim', pos: 'G', strength: 42, nat: 'BRA' },
      { name: 'Philippe Coutinho', pos: 'M', strength: 43, nat: 'BRA' },
      { name: 'Vegetti', pos: 'A', strength: 42, nat: 'ARG' },
    ],
  },
  {
    name: 'Ceará', short: 'CEA', colors: ['#000000', '#FFFFFF'], capacity: 63000, fans: 300,
    stars: [
      { name: 'Richardson', pos: 'M', strength: 38, nat: 'BRA' },
      { name: 'Pedro Raul', pos: 'A', strength: 40, nat: 'BRA' },
    ],
  },
  {
    name: 'Fortaleza', short: 'FOR', colors: ['#006CB5', '#EE1C25'], capacity: 63000, fans: 300,
    stars: [
      { name: 'João Ricardo', pos: 'G', strength: 41, nat: 'BRA' },
      { name: 'Lucero', pos: 'A', strength: 41, nat: 'ARG' },
      { name: 'Pochettino', pos: 'M', strength: 39, nat: 'ARG' },
    ],
  },
  {
    name: 'Sport Recife', short: 'SPT', colors: ['#D40000', '#000000'], capacity: 32000, fans: 300,
    stars: [{ name: 'Lucas Lima', pos: 'M', strength: 38, nat: 'BRA' }],
  },
  {
    name: 'Vitória', short: 'VIT', colors: ['#D40000', '#000000'], capacity: 30000, fans: 280,
    stars: [{ name: 'Renato Kayzer', pos: 'A', strength: 38, nat: 'BRA' }],
  },
  {
    name: 'Juventude', short: 'JUV', colors: ['#009846', '#FFFFFF'], capacity: 19000, fans: 120,
  },
  {
    name: 'Mirassol', short: 'MIR', colors: ['#FFD200', '#00893D'], capacity: 15000, fans: 80,
    stars: [{ name: 'Reinaldo', pos: 'D', strength: 38, nat: 'BRA' }],
  },
  {
    name: 'RB Bragantino', short: 'RBB', colors: ['#FFFFFF', '#D40000'], capacity: 17000, fans: 100,
    stars: [{ name: 'Cleiton', pos: 'G', strength: 40, nat: 'BRA' }],
  },
]

// Série B
export const SERIE_B: ClubSeed[] = [
  { name: 'Coritiba', short: 'CFC', colors: ['#00544E', '#FFFFFF'], capacity: 40000, fans: 250 },
  { name: 'Athletico-PR', short: 'CAP', colors: ['#D40000', '#000000'], capacity: 42000, fans: 250 },
  { name: 'Chapecoense', short: 'CHA', colors: ['#009846', '#FFFFFF'], capacity: 20000, fans: 150 },
  { name: 'Goiás', short: 'GOI', colors: ['#009846', '#FFFFFF'], capacity: 14000, fans: 180 },
  { name: 'Criciúma', short: 'CRI', colors: ['#FFD200', '#000000'], capacity: 19000, fans: 120 },
  { name: 'Vila Nova', short: 'VIL', colors: ['#D40000', '#FFFFFF'], capacity: 12000, fans: 100 },
  { name: 'Novorizontino', short: 'NOV', colors: ['#FFD200', '#000000'], capacity: 16000, fans: 60 },
  { name: 'Avaí', short: 'AVA', colors: ['#0066B3', '#FFFFFF'], capacity: 17800, fans: 110 },
  { name: 'Remo', short: 'REM', colors: ['#003DA5', '#FFFFFF'], capacity: 16000, fans: 200 },
  { name: 'Paysandu', short: 'PAY', colors: ['#0066B3', '#FFFFFF'], capacity: 16000, fans: 200 },
  { name: 'CRB', short: 'CRB', colors: ['#FFFFFF', '#D40000'], capacity: 17000, fans: 130 },
  { name: 'Operário-PR', short: 'OPE', colors: ['#000000', '#FFFFFF'], capacity: 10000, fans: 60 },
  { name: 'Amazonas', short: 'AMA', colors: ['#FFD200', '#000000'], capacity: 31000, fans: 80 },
  { name: 'América-MG', short: 'AME', colors: ['#009846', '#000000'], capacity: 23000, fans: 150 },
  { name: 'Atlético-GO', short: 'ACG', colors: ['#D40000', '#000000'], capacity: 12000, fans: 110 },
  { name: 'Cuiabá', short: 'CUI', colors: ['#FFD200', '#009846'], capacity: 44000, fans: 80 },
  { name: 'Botafogo-SP', short: 'BSP', colors: ['#D40000', '#FFFFFF'], capacity: 29000, fans: 70 },
  { name: 'Ferroviária', short: 'FER', colors: ['#800020', '#FFFFFF'], capacity: 21000, fans: 50 },
  { name: 'Volta Redonda', short: 'VRE', colors: ['#FFD200', '#000000'], capacity: 18000, fans: 50 },
  { name: 'Athletic-MG', short: 'ATH', colors: ['#000000', '#D40000'], capacity: 10000, fans: 40 },
]

// Série C
export const SERIE_C: ClubSeed[] = [
  { name: 'Ponte Preta', short: 'PON', colors: ['#000000', '#FFFFFF'], capacity: 17000, fans: 140 },
  { name: 'Náutico', short: 'NAU', colors: ['#D40000', '#FFFFFF'], capacity: 22000, fans: 160 },
  { name: 'Londrina', short: 'LON', colors: ['#0066B3', '#FFFFFF'], capacity: 31000, fans: 80 },
  { name: 'São Bernardo', short: 'SBE', colors: ['#FFD200', '#000000'], capacity: 15000, fans: 40 },
  { name: 'Guarani', short: 'GUA', colors: ['#009846', '#FFFFFF'], capacity: 30000, fans: 130 },
  { name: 'Ituano', short: 'ITU', colors: ['#D40000', '#000000'], capacity: 18000, fans: 50 },
  { name: 'ABC', short: 'ABC', colors: ['#000000', '#FFFFFF'], capacity: 32000, fans: 120 },
  { name: 'Botafogo-PB', short: 'BPB', colors: ['#000000', '#D40000'], capacity: 26000, fans: 90 },
  { name: 'Confiança', short: 'CON', colors: ['#0066B3', '#FFFFFF'], capacity: 16000, fans: 70 },
  { name: 'CSA', short: 'CSA', colors: ['#0066B3', '#FFFFFF'], capacity: 17000, fans: 110 },
  { name: 'Figueirense', short: 'FIG', colors: ['#000000', '#FFFFFF'], capacity: 19000, fans: 110 },
  { name: 'Brusque', short: 'BRU', colors: ['#FFD200', '#009846'], capacity: 5000, fans: 30 },
  { name: 'Ypiranga-RS', short: 'YPI', colors: ['#FFD200', '#009846'], capacity: 7000, fans: 30 },
  { name: 'Caxias', short: 'CAX', colors: ['#800020', '#FFFFFF'], capacity: 30000, fans: 60 },
  { name: 'Floresta', short: 'FLO', colors: ['#009846', '#000000'], capacity: 8000, fans: 20 },
  { name: 'Tombense', short: 'TOM', colors: ['#D40000', '#FFFFFF'], capacity: 6000, fans: 15 },
  { name: 'Sampaio Corrêa', short: 'SAM', colors: ['#FFD200', '#009846'], capacity: 40000, fans: 100 },
  { name: 'Maringá', short: 'MAR', colors: ['#0066B3', '#FFD200'], capacity: 20000, fans: 40 },
  { name: 'Itabaiana', short: 'ITA', colors: ['#D40000', '#0066B3'], capacity: 8000, fans: 25 },
  { name: 'Anápolis', short: 'ANA', colors: ['#009846', '#FFFFFF'], capacity: 10000, fans: 20 },
]

// Série D (recorte de 20 clubes tradicionais/regionais)
export const SERIE_D: ClubSeed[] = [
  { name: 'Santa Cruz', short: 'STA', colors: ['#D40000', '#000000'], capacity: 60000, fans: 250 },
  { name: 'Portuguesa', short: 'POR', colors: ['#D40000', '#009846'], capacity: 21000, fans: 120 },
  { name: 'Joinville', short: 'JEC', colors: ['#D40000', '#000000'], capacity: 22000, fans: 80 },
  { name: 'América-RN', short: 'ARN', colors: ['#D40000', '#FFFFFF'], capacity: 32000, fans: 90 },
  { name: 'Treze', short: 'TRE', colors: ['#000000', '#FFFFFF'], capacity: 20000, fans: 60 },
  { name: 'Juazeirense', short: 'JUA', colors: ['#FFD200', '#0066B3'], capacity: 8000, fans: 15 },
  { name: 'Manaus', short: 'MAN', colors: ['#009846', '#FFD200'], capacity: 31000, fans: 50 },
  { name: 'São José-RS', short: 'SJO', colors: ['#0066B3', '#FFFFFF'], capacity: 8000, fans: 15 },
  { name: 'Inter de Limeira', short: 'LIM', colors: ['#FFFFFF', '#009846'], capacity: 25000, fans: 40 },
  { name: 'Pouso Alegre', short: 'POU', colors: ['#0066B3', '#FFFFFF'], capacity: 12000, fans: 20 },
  { name: 'Ferroviário-CE', short: 'FCE', colors: ['#D40000', '#000000'], capacity: 20000, fans: 50 },
  { name: 'Altos', short: 'ALT', colors: ['#FFD200', '#0066B3'], capacity: 8000, fans: 15 },
  { name: 'Sergipe', short: 'SER', colors: ['#D40000', '#FFFFFF'], capacity: 16000, fans: 50 },
  { name: 'Sousa', short: 'SOU', colors: ['#009846', '#FFD200'], capacity: 10000, fans: 20 },
  { name: 'Ceilândia', short: 'CEI', colors: ['#000000', '#FFD200'], capacity: 27000, fans: 25 },
  { name: 'Brasiliense', short: 'BRA', colors: ['#FFD200', '#000000'], capacity: 27000, fans: 30 },
  { name: 'Rio Branco-AC', short: 'RBR', colors: ['#D40000', '#FFFFFF'], capacity: 20000, fans: 20 },
  { name: 'Costa Rica-MS', short: 'CRC', colors: ['#009846', '#FFD200'], capacity: 8000, fans: 10 },
  { name: 'Cianorte', short: 'CIA', colors: ['#0066B3', '#FFD200'], capacity: 8000, fans: 10 },
  { name: 'Marcílio Dias', short: 'MDI', colors: ['#D40000', '#0066B3'], capacity: 9000, fans: 15 },
]

export const ALL_DIVISIONS: ClubSeed[][] = [SERIE_A, SERIE_B, SERIE_C, SERIE_D]

// Nível "de clube" (1-20) por divisão, usado na fórmula de força dos
// jogadores gerados (base = 2 + round(nível×2.2), força = base ±
// Random(0..6), goleiro -2): Série A ~25-37 (sob os craques manuais
// 40-47), B ~14-26, C ~7-19, D ~1-12 — times fracos de verdade.
export const DIVISION_LEVEL: number[] = [13, 8, 5, 2]

export const FOREIGN_NATS = ['ARG', 'URU', 'PAR', 'COL', 'CHI', 'EQU', 'VEN', 'PER', 'BOL', 'MEX']

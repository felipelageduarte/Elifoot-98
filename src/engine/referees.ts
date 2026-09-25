import { pick, randInt } from './rng'

// Quadro de árbitros sorteados a cada partida
export const REFEREES = [
  'Olegário Benquerença', 'Vítor Pereira', 'Lucílio Baptista', 'Pedro Proença',
  'Jorge Sousa', 'Duarte Gomes', 'Carlos Xistra', 'João Ferreira',
  'Arnaldo Cezar Coelho', 'Marcio Rezende de Freitas', 'Oscar Roberto Godoi',
  'Edilson Pereira de Carvalho', 'Wilson Seneme', 'Carlos Simon', 'Leonardo Gaciba',
  'Anderson Daronco', 'Raphael Claus', 'Wilton Sampaio', 'Braulio Machado',
  'Ramon Abatti Abel', 'Markus Merk', 'Helmut Krug', 'Kim Milton Nielsen',
  'Peter Mikkelsen', 'Pierluigi Pairetto', 'Paolo Collina', 'David Elleray',
  'Anders Frisk', 'Dick Jol', 'Manuel Diaz Vega', 'Garcia Aranda', 'Sandor Puhl',
]

export interface MatchReferee {
  name: string
  homeAid: number // 0..15, 10 = neutro (medidores do original)
  awayAid: number
}

// Sorteia árbitro e a sua "ajuda" a cada equipe
export function drawReferee(pool: string[]): MatchReferee {
  return {
    name: pick(pool.length > 0 ? pool : REFEREES),
    homeAid: randInt(7, 13),
    awayAid: randInt(7, 13),
  }
}

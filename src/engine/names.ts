import { pick, rand } from './rng'

const FIRST = [
  'Adriano', 'Alan', 'Alex', 'Anderson', 'André', 'Antônio', 'Arthur', 'Breno', 'Bruno',
  'Caio', 'Carlos', 'Cauã', 'César', 'Cristiano', 'Daniel', 'Danilo', 'Davi', 'Denílson',
  'Diego', 'Douglas', 'Éder', 'Edson', 'Eduardo', 'Emerson', 'Enzo', 'Éverton', 'Fábio',
  'Felipe', 'Fernando', 'Flávio', 'Gabriel', 'Geraldo', 'Gilberto', 'Guilherme', 'Gustavo',
  'Heitor', 'Hélio', 'Henrique', 'Hugo', 'Igor', 'Ítalo', 'Ivan', 'Jailson', 'Jean',
  'João', 'Jonas', 'Jorge', 'José', 'Juan', 'Júlio', 'Kaique', 'Kléber', 'Leandro',
  'Léo', 'Lucas', 'Luiz', 'Marcelo', 'Márcio', 'Marcos', 'Mateus', 'Maurício', 'Miguel',
  'Murilo', 'Nathan', 'Neto', 'Nícolas', 'Otávio', 'Pablo', 'Paulo', 'Pedro', 'Rafael',
  'Raí', 'Ramon', 'Renan', 'Renato', 'Ricardo', 'Roberto', 'Robson', 'Rodrigo', 'Rogério',
  'Romário', 'Ronaldo', 'Samuel', 'Sandro', 'Sérgio', 'Thiago', 'Tiago', 'Vagner',
  'Valdir', 'Vanderlei', 'Vinícius', 'Vítor', 'Wagner', 'Walter', 'Wellington', 'Wesley',
  'William', 'Wilson', 'Yago', 'Yuri',
]

const LAST = [
  'Almeida', 'Alves', 'Andrade', 'Araújo', 'Assis', 'Azevedo', 'Barbosa', 'Barros',
  'Batista', 'Bezerra', 'Borges', 'Braga', 'Brito', 'Campos', 'Cardoso', 'Carvalho',
  'Castro', 'Cavalcanti', 'Coelho', 'Correia', 'Costa', 'Cruz', 'Cunha', 'Dias',
  'Duarte', 'Farias', 'Fernandes', 'Ferreira', 'Fonseca', 'Freitas', 'Garcia', 'Gomes',
  'Gonçalves', 'Guimarães', 'Henriques', 'Lima', 'Lopes', 'Macedo', 'Machado', 'Magalhães',
  'Marques', 'Martins', 'Melo', 'Mendes', 'Miranda', 'Monteiro', 'Moraes', 'Moreira',
  'Moura', 'Nascimento', 'Neves', 'Nogueira', 'Nunes', 'Oliveira', 'Pacheco', 'Peixoto',
  'Pereira', 'Pinto', 'Pires', 'Queiroz', 'Ramos', 'Reis', 'Ribeiro', 'Rocha',
  'Rodrigues', 'Sales', 'Santana', 'Santos', 'Silva', 'Silveira', 'Siqueira', 'Soares',
  'Sousa', 'Souza', 'Tavares', 'Teixeira', 'Torres', 'Vasconcelos', 'Viana', 'Vieira',
  'Xavier',
]

const NICK = [
  'Betinho', 'Bidu', 'Biro', 'Cacá', 'Careca', 'Catito', 'Chiquinho', 'Cidinho',
  'Dedé', 'Dida', 'Dinho', 'Ganso', 'Gaúcho', 'Índio', 'Jajá', 'Juninho', 'Kiko',
  'Lelê', 'Lico', 'Lulinha', 'Magrão', 'Maranhão', 'Mineiro', 'Nenê', 'Nino',
  'Paraná', 'Pelezinho', 'Pingo', 'Pixote', 'Russo', 'Serginho', 'Tato', 'Teco',
  'Tita', 'Toninho', 'Tuca', 'Xandão', 'Zeca', 'Zinho', 'Zito',
]

export function playerName(): string {
  const r = rand()
  if (r < 0.12) return pick(NICK)
  if (r < 0.35) return pick(FIRST)
  if (r < 0.5) return `${pick(FIRST)} ${pick(LAST)} ${pick(LAST).charAt(0)}.`
  return `${pick(FIRST)} ${pick(LAST)}`
}

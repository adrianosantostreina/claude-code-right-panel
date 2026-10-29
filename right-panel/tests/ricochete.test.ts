import { expect, test } from 'claude-code/testing'
import {
  RICOCHETE_LEVELS,
  deflect,
  loadRicochete,
  newRicochete,
  ricocheteClick,
  ricocheteKey,
  ricocheteStep,
  ricocheteTick,
  speedOf,
} from '../hooks/ricochete.js'

// Sorteio fixo: a fase abre sempre igual e o teste põe a bolinha onde quer.
const fixed = () => 0.5

function game(level = 0) {
  const g = newRicochete(fixed)
  g.level = level
  loadRicochete(g, fixed)
  return g
}

function place(g, x: number, y: number, dir: string) {
  g.ball = { x, y, dir }
  g.wait = 0
}

const tri = (g, x: number, y: number) => g.tris[y][x]

test('fases: 10 mapas 18×12, um gol na borda cada', () => {
  expect(RICOCHETE_LEVELS.length).toBe(10)
  for (const level of RICOCHETE_LEVELS) {
    expect(level.map.length).toBe(12)
    let goals = 0
    level.map.forEach((row, y) => {
      expect(row.length).toBe(18)
      ;[...row].forEach((c, x) => {
        if (c !== 'G') return
        goals++
        expect(y === 0 || y === 11 || x === 0 || x === 17).toBe(true)
      })
    })
    expect(goals).toBe(1)
  }
  expect(RICOCHETE_LEVELS[8].time).toBe(60)
  expect(RICOCHETE_LEVELS[9].time).toBe(45)
  expect(RICOCHETE_LEVELS[9].limit).toBe(6)
  expect([speedOf(0), speedOf(5), speedOf(6), speedOf(7), speedOf(8), speedOf(9)]).toEqual([150, 150, 120, 120, 100, 100])
})

test('desvio: lados abertos viram 90°, fechados devolvem null', () => {
  const table = {
    0: { left: 'up', down: 'right', right: null, up: null }, // ◺
    1: { left: 'down', up: 'right', right: null, down: null }, // ◸
    2: { right: 'down', up: 'left', left: null, down: null }, // ◹
    3: { right: 'up', down: 'left', left: null, up: null }, // ◿
  }
  for (const [shape, dirs] of Object.entries(table)) {
    for (const [dir, out] of Object.entries(dirs)) expect(deflect(Number(shape), dir)).toBe(out)
  }
})

test('passo: parede devolve a bolinha sem sair da casa', () => {
  const g = game()
  place(g, 1, 5, 'left')
  ricocheteStep(g)
  expect(g.ball).toEqual({ x: 1, y: 5, dir: 'right' })
  ricocheteStep(g)
  expect(g.ball).toEqual({ x: 2, y: 5, dir: 'right' })
})

test('passo: triângulo aberto desvia; fechado devolve como parede', () => {
  const g = game()
  g.tris[5][4] = 0 // ◺: abre em cima e à direita
  place(g, 6, 5, 'left')
  ricocheteStep(g)
  ricocheteStep(g)
  expect(g.ball).toEqual({ x: 4, y: 5, dir: 'up' })
  ricocheteStep(g)
  expect(g.ball).toEqual({ x: 4, y: 4, dir: 'up' })

  place(g, 2, 5, 'right') // entra pelo lado fechado da esquerda
  ricocheteStep(g)
  ricocheteStep(g)
  expect(g.ball).toEqual({ x: 3, y: 5, dir: 'left' })
})

test('passo: batida logo depois do desvio refaz o caminho de entrada', () => {
  const g = game()
  g.tris[1][4] = 0 // ◺ encostado na parede de cima
  place(g, 6, 1, 'left')
  ricocheteStep(g)
  ricocheteStep(g)
  expect(g.ball).toEqual({ x: 4, y: 1, dir: 'up' })
  ricocheteStep(g) // bate em cima, desce de volta na diagonal e sai para a direita
  expect(g.ball).toEqual({ x: 4, y: 1, dir: 'right' })
  ricocheteStep(g)
  expect(g.ball).toEqual({ x: 5, y: 1, dir: 'right' })
})

test('gol marca ponto e espera o espaço; buraco perde e o espaço reinicia limpo', () => {
  const g = game()
  place(g, 8, 1, 'up') // fase 1: gol em cima, coluna 8
  ricocheteStep(g)
  expect(g.cleared).toBe(true)
  expect(g.score).toBe(1)
  expect(ricocheteTick(g, 1000)).toBe(false) // parado esperando o espaço
  expect(ricocheteKey(g, 'space')).toBe(true)
  expect(g.level).toBe(1)
  expect(g.cleared).toBe(false)

  const h = game(6) // fase 7: buraco em (8,5)
  h.tris[1][1] = 2
  place(h, 6, 5, 'right')
  ricocheteStep(h)
  ricocheteStep(h)
  expect(h.lost).toBe('buraco')
  expect(h.ball).toMatchObject({ x: 8, y: 5 })
  expect(ricocheteKey(h, 'space')).toBe(true)
  expect(h.lost).toBe('')
  expect(h.level).toBe(6)
  expect(tri(h, 1, 1)).toBe(-1)
})

test('cronômetro zera e perde por tempo; pausa congela bolinha e relógio', () => {
  const g = game(8) // fase 9: 60 s
  expect(g.timeLeft).toBe(60_000)
  g.paused = true
  const before = { ...g.ball }
  expect(ricocheteTick(g, 5000)).toBe(false)
  expect(g.timeLeft).toBe(60_000)
  expect(g.ball).toEqual(before)

  g.paused = false
  g.timeLeft = 50
  ricocheteTick(g, 60)
  expect(g.lost).toBe('tempo')
  ricocheteKey(g, 'space')
  expect(g.timeLeft).toBe(60_000)
})

test('tick anda uma casa a cada intervalo da fase', () => {
  const g = game()
  place(g, 5, 5, 'right')
  expect(ricocheteTick(g, 100)).toBe(false)
  expect(ricocheteTick(g, 60)).toBe(true)
  expect(g.ball).toMatchObject({ x: 6, y: 5 })
})

test('clique: põe ◺, gira até ◿, o 5º remove; direito remove; parede/buraco/gol/bolinha ignorados', () => {
  const g = game(6) // fase 7 tem buraco em (8,5) e gol em (3,0)
  place(g, 10, 9, 'left')
  expect(ricocheteClick(g, 2, 2, 'left')).toBe(true)
  expect(tri(g, 2, 2)).toBe(0)
  for (const shape of [1, 2, 3]) {
    ricocheteClick(g, 2, 2, 'left')
    expect(tri(g, 2, 2)).toBe(shape)
  }
  ricocheteClick(g, 2, 2, 'left')
  expect(tri(g, 2, 2)).toBe(-1)

  ricocheteClick(g, 2, 2, 'left')
  expect(ricocheteClick(g, 2, 2, 'right')).toBe(true)
  expect(tri(g, 2, 2)).toBe(-1)
  expect(ricocheteClick(g, 2, 2, 'right')).toBe(false)

  for (const [x, y] of [[0, 0], [3, 7], [8, 5], [3, 0], [10, 9], [20, 3], [-1, 2]]) {
    expect(ricocheteClick(g, x, y, 'left')).toBe(false)
  }
})

test('limite: fase 10 recusa o 7º triângulo, mas gira e remove', () => {
  const g = game(9)
  place(g, 15, 10, 'left')
  for (let x = 1; x <= 5; x++) ricocheteClick(g, x, 5, 'left')
  ricocheteClick(g, 7, 5, 'left')
  expect(ricocheteClick(g, 8, 5, 'left')).toBe(false)
  expect(tri(g, 8, 5)).toBe(-1)
  expect(ricocheteClick(g, 1, 5, 'left')).toBe(true)
  expect(tri(g, 1, 5)).toBe(1)
  ricocheteClick(g, 2, 5, 'right')
  expect(ricocheteClick(g, 8, 5, 'left')).toBe(true)
})

test('início justo: 4 passos sem triângulo não caem em buraco nem no gol, e não começa ao lado de buraco', () => {
  for (let level = 0; level < RICOCHETE_LEVELS.length; level++) {
    const map = RICOCHETE_LEVELS[level].map
    for (let i = 0; i < 200; i++) {
      const g = newRicochete()
      g.level = level
      loadRicochete(g)
      const { x, y } = g.ball
      expect(map[y][x]).toBe('.')
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) expect(map[y + dy][x + dx]).not.toBe('O')
      for (let s = 0; s < 4; s++) ricocheteStep(g)
      expect(g.lost).toBe('')
      expect(g.cleared).toBe(false)
    }
  }
})

test('r reinicia a fase; depois da 10ª o gol vira won/over', () => {
  const g = game(9)
  g.tris[5][5] = 0
  expect(ricocheteKey(g, 'r')).toBe(true)
  expect(tri(g, 5, 5)).toBe(-1)
  expect(g.level).toBe(9)

  place(g, 1, 1, 'left') // fase 10: gol na esquerda, linha 1
  ricocheteStep(g)
  expect(g.won).toBe(true)
  expect(g.over).toBe(true)
  expect(g.score).toBe(1)
})

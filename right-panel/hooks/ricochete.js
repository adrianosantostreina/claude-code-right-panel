// Ricochete: a lógica do 5º jogo do fliperama, sem desenho.
//
// Uma bolinha anda sozinha em linha reta, uma casa por passo, e volta ao bater
// em parede. O jogador põe e gira triângulos com o mouse para desviá-la até o
// gol (uma abertura na borda); cair num buraco preto ou estourar o tempo perde
// a fase. O sorteio entra como parâmetro para os testes fixarem a fase.

// # parede · G gol · O buraco · . vazio. 18×12 casas com a borda.
export const RICOCHETE_LEVELS = [
  { name: 'Primeiro gol', map: [
    '########G#########',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '##################',
  ] },
  { name: 'Pela lateral', map: [
    '##################',
    '#................#',
    '#................#',
    '#................G',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '##################',
  ] },
  { name: 'Lá embaixo', map: [
    '##################',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    'G................#',
    '#................#',
    '##################',
  ] },
  { name: 'Pilar', map: [
    '############G#####',
    '#................#',
    '#................#',
    '#................#',
    '#.......#........#',
    '#.......#........#',
    '#.......#........#',
    '#.......#........#',
    '#.......#........#',
    '#.......#........#',
    '#................#',
    '##################',
  ] },
  { name: 'Prateleira', map: [
    '########G#########',
    '#................#',
    '#................#',
    '#....########....#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '##################',
  ] },
  { name: 'Ziguezague', map: [
    '##################',
    '#.....#..........#',
    '#.....#..........#',
    '#.....#..........#',
    '#.....#..........#',
    '#.....#....#.....G',
    '#.....#....#.....#',
    '#..........#.....#',
    '#..........#.....#',
    '#..........#.....#',
    '#..........#.....#',
    '##################',
  ] },
  { name: 'Buraco', map: [
    '###G##############',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#.......O........#',
    '#................#',
    '#..#####.........#',
    '#................#',
    '#................#',
    '#................#',
    '##################',
  ] },
  { name: 'Guardas', map: [
    '##################',
    '#.........#......#',
    '#.........#......#',
    '#.........#......#',
    '#..............O.#',
    '#................G',
    '#..............O.#',
    '#.........#......#',
    '#.........#......#',
    '#.........#......#',
    '#.........#......#',
    '##################',
  ] },
  { name: 'Contra o relógio', time: 60, map: [
    '##################',
    '#................#',
    '#...O......#.....#',
    '#..........#.....#',
    '#..#####...#.....#',
    '#................#',
    '#.......O........#',
    '#.....#######....#',
    '#................#',
    '#..........O.....#',
    '#................#',
    '#############G####',
  ] },
  { name: 'Labirinto', time: 45, limit: 6, map: [
    '##################',
    'G.....#..........#',
    '#.....#....O.....#',
    '#.....#..........#',
    '#.....#####..#####',
    '#................#',
    '#..O.............#',
    '####.....#####...#',
    '#........#.......#',
    '#........#...O...#',
    '#................#',
    '##################',
  ] },
  // 11–20: as mesmas peças, mais apertadas, e relógio com limite juntos no fim.
  { name: 'Telhado', map: [
    '########G#########',
    '#................#',
    '#...##########...#',
    '#...#........#...#',
    '#...#........#...#',
    '#...#........#...#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '#................#',
    '##################',
  ] },
  { name: 'Ilhas', map: [
    '##################',
    '#................#',
    '#..##......##....#',
    '#..##......##....#',
    '#.......O........#',
    '#................#',
    '#....##.....##...G',
    '#....##.....##...#',
    '#.........O......#',
    '#................#',
    '#................#',
    '##################',
  ] },
  { name: 'Funil', map: [
    '##################',
    '#................#',
    '#................#',
    '##..............##',
    '#.#.....O......#.#',
    '#..#..........#..#',
    '#...#........#...#',
    '#....#......#....#',
    '#.....#....#.....#',
    '#......#..#......#',
    '#................#',
    '########G#########',
  ] },
  { name: 'Pente', time: 60, map: [
    '##################',
    '#................#',
    '#.#.#.#.#.#.#.#..#',
    '#.#.#.#.#.#.#.#..#',
    '#.#.#.#.#.#.#.#..#',
    '#.#.#.#.#.#.#.#..#',
    '#................#',
    '#................#',
    '#....O......O....#',
    '#................#',
    '#................G',
    '##################',
  ] },
  { name: 'Cofre', limit: 5, map: [
    '##################',
    '#................#',
    '#................#',
    '#................#',
    '######...........#',
    '#....#...........#',
    'G....#...........#',
    '#....#...........#',
    '#.####...........#',
    '#................#',
    '#..O.............#',
    '##################',
  ] },
  { name: 'Campo minado', map: [
    '#############G####',
    '#................#',
    '#..O.....O.......#',
    '#..............O.#',
    '#.....O..........#',
    '#...........O....#',
    '#..O.............#',
    '#........O.......#',
    '#..............O.#',
    '#....O...........#',
    '#..........O.....#',
    '##################',
  ] },
  { name: 'Serpente', time: 60, map: [
    '##################',
    '#................#',
    '#................#',
    '##############...#',
    '#................#',
    '#.......O........#',
    '#...##############',
    '#.....O..........#',
    '#................#',
    '##############...#',
    'G................#',
    '##################',
  ] },
  { name: 'Taça', time: 50, limit: 5, map: [
    '##################',
    '#................#',
    '#..####....####..#',
    '#..#..........#..#',
    '#..#..O....O..#..#',
    '#................#',
    '#......####......#',
    '#......#..#......#',
    '#...O..#..#..O...#',
    '#................#',
    '#......O.O.......#',
    '########G#########',
  ] },
  { name: 'Muralha', time: 45, limit: 5, map: [
    '##################',
    '#.......#........#',
    '#.......#........G',
    '#.......#...O....#',
    '#.......#........#',
    '#..O....#........#',
    '#.......#######..#',
    '#.......#........#',
    '#.......#O.......#',
    '#................#',
    '#.......#O.......#',
    '##################',
  ] },
  { name: 'Grande final', time: 40, limit: 4, map: [
    '##G###############',
    '#..#.............#',
    '#..#..O......O...#',
    '#..#.............#',
    '#..#....######...#',
    '#..#....#....#...#',
    '#..#....#.O..#...#',
    '#..#.............#',
    '#..#........O....#',
    '#...O............#',
    '#................#',
    '##################',
  ] },
]

// Índice = orientação: nasce ◺ e cada clique gira 90° no sentido horário.
export const TRIANGLES = ['◺', '◸', '◹', '◿']

const STEP = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const BACK = { up: 'down', down: 'up', left: 'right', right: 'left' }
const DIR_NAMES = ['up', 'down', 'left', 'right']

// Lados abertos de cada triângulo (os fechados são as pernas da quina reta).
const OPEN = [
  ['up', 'right'], // ◺
  ['right', 'down'], // ◸
  ['down', 'left'], // ◹
  ['left', 'up'], // ◿
]

// Fair start: quantos passos à frente o sorteio confere, e quantas vezes tenta.
const SAFE_STEPS = 4
const START_TRIES = 500

// Andando em `dir`, a bolinha entra pelo lado oposto; se ele é aberto, sai pelo outro lado aberto.
export function deflect(shape, dir) {
  const open = OPEN[shape]
  const entry = BACK[dir]
  if (!open.includes(entry)) return null
  return open[0] === entry ? open[1] : open[0]
}

export function speedOf(level) {
  if (level >= 8) return 100
  if (level >= 6) return 120
  return 150
}

export function newRicochete(rand = Math.random) {
  const game = { id: 'ricochete', score: 0, over: false, won: false, paused: false, level: 0, rand }
  loadRicochete(game, rand)
  return game
}

// Abre (ou reabre) a fase atual: campo limpo, bolinha sorteada e cronômetro cheio.
export function loadRicochete(game, rand = game.rand || Math.random) {
  const level = RICOCHETE_LEVELS[game.level]
  game.grid = level.map
  game.tris = level.map.map((row) => [...row].map(() => -1))
  game.cleared = false
  game.lost = ''
  game.wait = 0
  game.timeLeft = level.time ? level.time * 1000 : null
  game.ball = fairStart(game, rand)
}

// Uma casa vazia longe de buraco, numa direção que não cai em buraco nem faz gol logo de cara.
function fairStart(game, rand) {
  const cells = []
  game.grid.forEach((row, y) =>
    [...row].forEach((c, x) => {
      if (c === '.' && !nearHole(game.grid, x, y)) cells.push({ x, y })
    }),
  )
  let pick = null
  for (let i = 0; i < START_TRIES; i++) {
    const cell = cells[Math.floor(rand() * cells.length)]
    const ball = { ...cell, dir: DIR_NAMES[Math.floor(rand() * DIR_NAMES.length)] }
    pick = ball
    if (safeFrom(game, ball)) return ball
  }
  // Sorteio viciado (só nos testes): procura em ordem a primeira largada segura.
  for (const cell of cells) {
    for (const dir of DIR_NAMES) if (safeFrom(game, { ...cell, dir })) return { ...cell, dir }
  }
  return pick
}

function nearHole(grid, x, y) {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) if ((grid[y + dy] || '')[x + dx] === 'O') return true
  }
  return false
}

function safeFrom(game, ball) {
  const probe = { grid: game.grid, tris: game.tris, ball: { ...ball }, level: game.level, score: 0, cleared: false, lost: '' }
  for (let i = 0; i < SAFE_STEPS; i++) {
    ricocheteStep(probe)
    if (probe.lost || probe.cleared || probe.over) return false
  }
  return true
}

// Um passo da bolinha: anda, desvia no triângulo, volta na parede, faz gol ou cai.
export function ricocheteStep(game) {
  const { ball } = game
  const [dx, dy] = STEP[ball.dir]
  const x = ball.x + dx
  const y = ball.y + dy
  const cell = (game.grid[y] || '')[x]

  if (cell === 'G') {
    game.score++
    if (game.level + 1 >= RICOCHETE_LEVELS.length) {
      game.won = true
      game.over = true
    } else {
      game.cleared = true
    }
    return
  }
  if (cell === 'O') {
    game.ball = { x, y, dir: ball.dir }
    game.lost = 'buraco'
    return
  }
  const shape = cell === '.' ? game.tris[y][x] : -1
  const turn = shape >= 0 ? deflect(shape, ball.dir) : ball.dir
  if (cell !== '.' || turn === null) {
    // Bateu: dentro de um triângulo, a volta passa de novo pela diagonal e refaz a entrada.
    const here = game.tris[ball.y][ball.x]
    game.ball = { x: ball.x, y: ball.y, dir: (here >= 0 && deflect(here, BACK[ball.dir])) || BACK[ball.dir] }
    return
  }
  game.ball = { x, y, dir: turn }
}

export function ricocheteTick(game, dt) {
  if (game.paused || game.cleared || game.lost || game.over) return false
  let changed = false
  if (game.timeLeft !== null) {
    const shown = Math.ceil(game.timeLeft / 1000)
    game.timeLeft = Math.max(0, game.timeLeft - dt)
    if (game.timeLeft === 0) {
      game.lost = 'tempo'
      return true
    }
    changed = Math.ceil(game.timeLeft / 1000) !== shown
  }
  game.wait += dt
  const speed = speedOf(game.level)
  while (game.wait >= speed && !game.cleared && !game.lost && !game.over) {
    game.wait -= speed
    ricocheteStep(game)
    changed = true
  }
  return changed
}

export function ricocheteKey(game, key) {
  if (game.cleared) {
    if (key !== 'space' && key !== 'enter') return false
    game.level++
    loadRicochete(game)
    return true
  }
  if (game.lost && (key === 'space' || key === 'enter')) {
    loadRicochete(game)
    return true
  }
  if (key === 'r') {
    loadRicochete(game)
    return true
  }
  return false
}

// Clique numa casa do campo: põe, gira (o 5º clique tira) ou, com o botão direito, tira.
export function ricocheteClick(game, x, y, button) {
  if (game.cleared || game.lost || game.over) return false
  if ((game.grid[y] || '')[x] !== '.') return false
  if (game.ball.x === x && game.ball.y === y) return false
  const shape = game.tris[y][x]
  if (button === 'right') {
    if (shape < 0) return false
    game.tris[y][x] = -1
    return true
  }
  if (button !== 'left') return false
  if (shape >= 0) {
    game.tris[y][x] = shape + 1 < TRIANGLES.length ? shape + 1 : -1
    return true
  }
  const limit = RICOCHETE_LEVELS[game.level].limit
  if (limit && trianglesOf(game) >= limit) return false
  game.tris[y][x] = 0
  return true
}

export function trianglesOf(game) {
  return game.tris.reduce((sum, row) => sum + row.filter((shape) => shape >= 0).length, 0)
}

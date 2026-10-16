// Fliperama do Right Panel (/game): Tetris, Snake e Pac-Man.
//
// Módulo de superfície de um Client: roda no thread de desenho do terminal,
// sem $, com estado local, relógio próprio (surface.every) e teclado
// (surface.onKey, que só recebe teclas depois que a área do jogo é clicada;
// o Esc devolve o teclado ao prompt). O recorde de cada partida sobe para o
// hooks module com surface.post, que o grava no $.store.

const TICK_MS = 40

const COLORS = {
  text: '#f8f8f2',
  dim: '#6272a4',
  faint: '#44475a',
  purple: '#bd93f9',
  pink: '#ff79c6',
  cyan: '#8be9fd',
  green: '#50fa7b',
  yellow: '#f1fa8c',
  orange: '#ffb86c',
  red: '#ff5555',
  blue: '#5f87ff',
}

const GAMES = [
  { id: 'tetris', name: 'Tetris', color: COLORS.cyan },
  { id: 'snake', name: 'Snake', color: COLORS.green },
  { id: 'pacman', name: 'Pac-Man', color: COLORS.yellow },
]

// Linha do menu onde aparece o primeiro jogo (para o clique do mouse).
const MENU_FIRST_ROW = 2

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
const OPPOSITE = { up: 'down', down: 'up', left: 'right', right: 'left' }

export default function Fliperama(props, surface) {
  const p = props || {}
  let world = surface.state ? surface.state.world : null
  if (!world) {
    // Primeira chamada: cria o estado e liga teclado, mouse e relógio uma vez só.
    const created = { screen: 'menu', pick: 0, game: null, best: {}, focused: false, version: 0 }
    world = created
    const redraw = () => surface.setState({ world: created, version: ++created.version })
    surface.onKey((event) => {
      if (onKey(created, keyName(event), surface)) redraw()
    })
    surface.onPointer((event) => {
      if (event.type === 'down' && onPointer(created, event)) redraw()
    })
    surface.every(TICK_MS, () => {
      if (onTick(created, TICK_MS, surface)) redraw()
    })
    surface.setState({ world: created, version: 0 })
  }
  syncFocus(world, p)
  return draw(world, p, surface.elements)
}

// ---------------------------------------------------------------- entrada

function keyName(event) {
  const key = String((event && event.key) || '')
  if (key === ' ' || key === 'space') return 'space'
  if (key === 'return' || key === 'enter') return 'enter'
  const lower = key.toLowerCase()
  if (lower === 'w') return 'up'
  if (lower === 'a') return 'left'
  if (lower === 's') return 'down'
  if (lower === 'd') return 'right'
  return lower
}

// O painel perdeu o foco no meio da partida (Esc): pausa para o jogo não seguir sozinho.
function syncFocus(world, p) {
  const focused = p.focused === true
  if (world.focused && !focused && world.game && !world.game.over) world.game.paused = true
  world.focused = focused
}

function onKey(world, key, surface) {
  if (world.screen === 'menu') {
    if (key === 'up') world.pick = (world.pick + GAMES.length - 1) % GAMES.length
    else if (key === 'down') world.pick = (world.pick + 1) % GAMES.length
    else if (key === 'space' || key === 'enter') startGame(world, world.pick)
    else if (key === '1' || key === '2' || key === '3') startGame(world, Number(key) - 1)
    else return false
    return true
  }

  const game = world.game
  if (key === 'q') {
    world.screen = 'menu'
    world.game = null
    return true
  }
  if (game.over) {
    if (key !== 'space' && key !== 'enter') return false
    startGame(world, world.pick)
    return true
  }
  if (key === 'p') {
    game.paused = !game.paused
    return true
  }
  if (game.paused) {
    if (key !== 'space' && key !== 'enter') return false
    game.paused = false
    return true
  }
  const changed = RULES[game.id].key(game, key)
  finish(world, surface)
  return changed
}

function onPointer(world, event) {
  if (world.screen !== 'menu') return false
  const index = event.y - MENU_FIRST_ROW
  if (index < 0 || index >= GAMES.length) return false
  startGame(world, index)
  return true
}

function onTick(world, dt, surface) {
  const game = world.game
  if (world.screen !== 'play' || !game || game.paused || game.over) return false
  const changed = RULES[game.id].tick(game, dt)
  finish(world, surface)
  return changed
}

function startGame(world, index) {
  world.pick = index
  world.screen = 'play'
  world.game = RULES[GAMES[index].id].create()
}

// Fim de partida: guarda o recorde local e avisa o hooks module uma vez.
function finish(world, surface) {
  const game = world.game
  if (!game || !game.over || game.posted) return
  game.posted = true
  game.isRecord = game.score > 0 && game.score > (world.best[game.id] || 0) && game.score > (world.highs[game.id] || 0)
  if (game.score > (world.best[game.id] || 0)) world.best[game.id] = game.score
  surface.post({ type: 'score', game: game.id, score: game.score })
}

function bestOf(world, p, id) {
  const highs = (p && p.highs) || {}
  return Math.max(world.best[id] || 0, Number(highs[id]) || 0)
}

// ---------------------------------------------------------------- Tetris

const TETRIS_W = 10
const TETRIS_H = 20
const LINE_POINTS = [0, 100, 300, 500, 800]

const PIECES = {
  I: { color: COLORS.cyan, cells: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { color: COLORS.yellow, cells: [[1, 1], [1, 1]] },
  T: { color: COLORS.purple, cells: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { color: COLORS.green, cells: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { color: COLORS.red, cells: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { color: COLORS.blue, cells: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { color: COLORS.orange, cells: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
}

function newTetris() {
  const game = {
    id: 'tetris',
    score: 0,
    lines: 0,
    level: 1,
    over: false,
    paused: false,
    acc: 0,
    board: Array.from({ length: TETRIS_H }, () => Array(TETRIS_W).fill(null)),
    bag: [],
    piece: null,
    next: null,
  }
  game.next = fromBag(game)
  spawnPiece(game)
  return game
}

// Sorteio em "saco de 7": cada peça sai uma vez antes de repetir.
function fromBag(game) {
  if (!game.bag.length) game.bag = shuffle(Object.keys(PIECES))
  return game.bag.pop()
}

function spawnPiece(game) {
  const type = game.next
  game.next = fromBag(game)
  const cells = PIECES[type].cells
  game.piece = { type, cells, x: Math.floor((TETRIS_W - cells[0].length) / 2), y: type === 'I' ? -1 : 0 }
  if (collides(game, game.piece.cells, game.piece.x, game.piece.y)) game.over = true
}

function collides(game, cells, px, py) {
  for (let y = 0; y < cells.length; y++) {
    for (let x = 0; x < cells[y].length; x++) {
      if (!cells[y][x]) continue
      const bx = px + x
      const by = py + y
      if (bx < 0 || bx >= TETRIS_W || by >= TETRIS_H) return true
      if (by >= 0 && game.board[by][bx]) return true
    }
  }
  return false
}

// Gira no sentido horário.
function rotate(cells) {
  return cells[0].map((_, i) => cells.map((row) => row[i]).reverse())
}

function tryMove(game, dx, dy) {
  const piece = game.piece
  if (collides(game, piece.cells, piece.x + dx, piece.y + dy)) return false
  piece.x += dx
  piece.y += dy
  return true
}

function rotatePiece(game) {
  const piece = game.piece
  const cells = rotate(piece.cells)
  // Encostada na parede ou em outra peça, tenta empurrar para o lado.
  for (const dx of [0, -1, 1, -2, 2]) {
    if (!collides(game, cells, piece.x + dx, piece.y)) {
      piece.cells = cells
      piece.x += dx
      return true
    }
  }
  return false
}

function lockPiece(game) {
  const piece = game.piece
  const color = PIECES[piece.type].color
  piece.cells.forEach((row, y) =>
    row.forEach((filled, x) => {
      if (!filled) return
      if (piece.y + y < 0) game.over = true
      else game.board[piece.y + y][piece.x + x] = color
    }),
  )
  const kept = game.board.filter((row) => row.some((cell) => !cell))
  const cleared = TETRIS_H - kept.length
  while (kept.length < TETRIS_H) kept.unshift(Array(TETRIS_W).fill(null))
  game.board = kept
  if (cleared) {
    game.score += LINE_POINTS[cleared] * game.level
    game.lines += cleared
    game.level = 1 + Math.floor(game.lines / 10)
  }
  game.acc = 0
  if (!game.over) spawnPiece(game)
}

function dropY(game) {
  const piece = game.piece
  let y = piece.y
  while (!collides(game, piece.cells, piece.x, y + 1)) y++
  return y
}

function tetrisTick(game, dt) {
  game.acc += dt
  if (game.acc < Math.max(70, 650 - (game.level - 1) * 55)) return false
  game.acc = 0
  if (!tryMove(game, 0, 1)) lockPiece(game)
  return true
}

function tetrisKey(game, key) {
  if (key === 'left') return tryMove(game, -1, 0)
  if (key === 'right') return tryMove(game, 1, 0)
  if (key === 'up') return rotatePiece(game)
  if (key === 'down') {
    if (tryMove(game, 0, 1)) {
      game.score += 1
      game.acc = 0
    } else {
      lockPiece(game)
    }
    return true
  }
  if (key === 'space') {
    let rows = 0
    while (tryMove(game, 0, 1)) rows++
    game.score += rows * 2
    lockPiece(game)
    return true
  }
  return false
}

function tetrisRows(game) {
  const grid = game.board.map((row) => row.map((color) => (color ? ['██', color] : [' ·', COLORS.faint])))
  if (!game.over) {
    const piece = game.piece
    const color = PIECES[piece.type].color
    paint(grid, piece.cells, piece.x, dropY(game), ['░░', color])
    paint(grid, piece.cells, piece.x, piece.y, ['██', color])
  }

  const next = PIECES[game.next]
  const preview = next.cells
    .filter((row) => row.some(Boolean))
    .map((row) => row.map((filled) => (filled ? ['██', next.color] : ['  ', null])))
  const side = [
    [['Próxima', COLORS.dim]],
    ...preview,
    [],
    [['Pontos', COLORS.dim]],
    [[String(game.score), COLORS.text]],
    [['Linhas', COLORS.dim]],
    [[String(game.lines), COLORS.text]],
    [['Nível', COLORS.dim]],
    [[String(game.level), COLORS.text]],
  ]

  const rows = [[['┌' + '──'.repeat(TETRIS_W) + '┐', COLORS.dim]]]
  grid.forEach((cells, y) => rows.push([['│', COLORS.dim], ...cells, ['│', COLORS.dim], ['  ', null], ...(side[y] || [])]))
  rows.push([['└' + '──'.repeat(TETRIS_W) + '┘', COLORS.dim]])
  return rows
}

function paint(grid, cells, px, py, cell) {
  cells.forEach((row, y) =>
    row.forEach((filled, x) => {
      const gy = py + y
      if (filled && gy >= 0 && gy < grid.length) grid[gy][px + x] = cell
    }),
  )
}

// ---------------------------------------------------------------- Snake

const SNAKE_W = 18
const SNAKE_H = 14

function newSnake() {
  const y = Math.floor(SNAKE_H / 2)
  const game = {
    id: 'snake',
    score: 0,
    over: false,
    paused: false,
    acc: 0,
    dir: 'right',
    queue: [],
    body: [{ x: 5, y }, { x: 4, y }, { x: 3, y }],
    food: null,
  }
  placeFood(game)
  return game
}

function placeFood(game) {
  const free = []
  for (let y = 0; y < SNAKE_H; y++) {
    for (let x = 0; x < SNAKE_W; x++) {
      if (!game.body.some((c) => c.x === x && c.y === y)) free.push({ x, y })
    }
  }
  game.food = free.length ? free[Math.floor(Math.random() * free.length)] : null
  if (!game.food) game.over = true // encheu o tabuleiro
}

function snakeTick(game, dt) {
  game.acc += dt
  if (game.acc < Math.max(55, 150 - game.body.length * 3)) return false
  game.acc = 0
  if (game.queue.length) game.dir = game.queue.shift()

  const [dx, dy] = DIRS[game.dir]
  const head = game.body[0]
  const next = { x: head.x + dx, y: head.y + dy }
  if (next.x < 0 || next.x >= SNAKE_W || next.y < 0 || next.y >= SNAKE_H) {
    game.over = true
    return true
  }
  const eating = game.food && next.x === game.food.x && next.y === game.food.y
  const body = eating ? game.body : game.body.slice(0, -1)
  if (body.some((c) => c.x === next.x && c.y === next.y)) {
    game.over = true
    return true
  }
  game.body = [next, ...body]
  if (eating) {
    game.score += 10
    placeFood(game)
  }
  return true
}

function snakeKey(game, key) {
  if (DIRS[key]) {
    // Fila curta para curvas rápidas; ignora a volta em cima do próprio corpo.
    const last = game.queue.length ? game.queue[game.queue.length - 1] : game.dir
    if (key !== last && key !== OPPOSITE[last] && game.queue.length < 3) game.queue.push(key)
    return false
  }
  if (key === 'space') {
    game.paused = true
    return true
  }
  return false
}

function snakeRows(game) {
  const grid = Array.from({ length: SNAKE_H }, () => Array.from({ length: SNAKE_W }, () => ['  ', null]))
  if (game.food) grid[game.food.y][game.food.x] = ['▐▌', COLORS.red]
  game.body.forEach((c, i) => {
    grid[c.y][c.x] = i === 0 ? ['██', game.over ? COLORS.red : COLORS.green] : ['▓▓', COLORS.green]
  })
  const rows = [[['┌' + '──'.repeat(SNAKE_W) + '┐', COLORS.dim]]]
  for (const cells of grid) rows.push([['│', COLORS.dim], ...cells, ['│', COLORS.dim]])
  rows.push([['└' + '──'.repeat(SNAKE_W) + '┘', COLORS.dim]])
  return rows
}

// ---------------------------------------------------------------- Pac-Man

// # parede · . ponto · o energizante · - porta da casa dos fantasmas
// P Pac-Man · B fantasma que começa fora · g fantasmas dentro da casa
// A linha 9 é o túnel: sai de um lado e entra do outro.
const MAZE = [
  '###################',
  '#........#........#',
  '#o##.###.#.###.##o#',
  '#.................#',
  '#.##.#.#####.#.##.#',
  '#....#...#...#....#',
  '####.###.#.###.####',
  '   #.#...B...#.#   ',
  '####.#.##-##.#.####',
  '    ...#ggg#...    ',
  '####.#.#####.#.####',
  '   #.#.......#.#   ',
  '####.#.#####.#.####',
  '#........#........#',
  '#.##.###.#.###.##.#',
  '#o.#.....P.....#.o#',
  '##.#.#.#####.#.#.##',
  '#....#...#...#....#',
  '#.######.#.######.#',
  '#.................#',
  '###################',
]
const MAZE_W = MAZE[0].length
const MAZE_H = MAZE.length

const GHOSTS = [
  { name: 'blinky', color: COLORS.red, corner: { x: MAZE_W - 1, y: 0 }, delay: 0 },
  { name: 'pinky', color: COLORS.pink, corner: { x: 0, y: 0 }, delay: 1500 },
  { name: 'inky', color: COLORS.cyan, corner: { x: MAZE_W - 1, y: MAZE_H - 1 }, delay: 4000 },
  { name: 'clyde', color: COLORS.orange, corner: { x: 0, y: MAZE_H - 1 }, delay: 7000 },
]

function findCells(char) {
  const found = []
  MAZE.forEach((row, y) => [...row].forEach((c, x) => c === char && found.push({ x, y })))
  return found
}

const PAC_START = findCells('P')[0]
const DOOR = findCells('-')[0]
const HOUSE = findCells('g')
const GHOST_STARTS = [findCells('B')[0], HOUSE[1], HOUSE[0], HOUSE[2]]

function newPacman() {
  const game = {
    id: 'pacman',
    score: 0,
    lives: 3,
    level: 1,
    over: false,
    paused: false,
    time: 0,
    wait: 1500,
    pacAcc: 0,
    ghostAcc: 0,
    scaredUntil: 0,
    combo: 0,
    dots: null,
    left: 0,
    pac: null,
    ghosts: [],
  }
  fillDots(game)
  resetActors(game)
  return game
}

function fillDots(game) {
  game.dots = MAZE.map((row) => [...row].map((c) => (c === '.' ? 'dot' : c === 'o' ? 'power' : null)))
  game.left = game.dots.flat().filter(Boolean).length
}

function resetActors(game) {
  game.pac = { x: PAC_START.x, y: PAC_START.y, dir: 'left', want: 'left' }
  game.ghosts = GHOSTS.map((g, i) => ({
    ...GHOST_STARTS[i],
    index: i,
    dir: 'left',
    out: i === 0,
    scared: false,
    release: game.time + g.delay,
  }))
  game.scaredUntil = 0
  game.modeStart = game.time
  game.pacAcc = 0
  game.ghostAcc = 0
}

function isWall(x, y) {
  if (y < 0 || y >= MAZE_H) return true
  const c = MAZE[y][(x + MAZE_W) % MAZE_W]
  return c === '#' || c === '-'
}

function stepFrom(x, y, dir) {
  const [dx, dy] = DIRS[dir]
  return { x: (x + dx + MAZE_W) % MAZE_W, y: y + dy }
}

function pacmanTick(game, dt) {
  game.time += dt
  if (game.wait > 0) {
    game.wait -= dt
    return game.wait <= 0
  }
  let changed = false

  if (game.scaredUntil && game.time >= game.scaredUntil) {
    game.scaredUntil = 0
    for (const ghost of game.ghosts) ghost.scared = false
    changed = true
  }

  game.pacAcc += dt
  if (game.pacAcc >= Math.max(110, 170 - (game.level - 1) * 10)) {
    game.pacAcc = 0
    movePac(game)
    collide(game)
    changed = true
  }
  if (game.over || game.wait > 0) return true

  game.ghostAcc += dt
  const ghostEvery = game.scaredUntil ? 320 : Math.max(120, 200 - (game.level - 1) * 12)
  if (game.ghostAcc >= ghostEvery) {
    game.ghostAcc = 0
    for (const ghost of game.ghosts) moveGhost(game, ghost)
    collide(game)
    changed = true
  }
  // Perto do fim do susto os fantasmas piscam.
  if (game.scaredUntil && game.scaredUntil - game.time < 2000) changed = true
  return changed
}

function movePac(game) {
  const pac = game.pac
  const wanted = stepFrom(pac.x, pac.y, pac.want)
  if (!isWall(wanted.x, wanted.y)) pac.dir = pac.want
  const next = stepFrom(pac.x, pac.y, pac.dir)
  if (isWall(next.x, next.y)) return
  pac.x = next.x
  pac.y = next.y

  const item = game.dots[pac.y][pac.x]
  if (!item) return
  game.dots[pac.y][pac.x] = null
  game.left -= 1
  if (item === 'dot') {
    game.score += 10
  } else {
    game.score += 50
    game.combo = 0
    game.scaredUntil = game.time + Math.max(2500, 7000 - (game.level - 1) * 1000)
    for (const ghost of game.ghosts) {
      if (!ghost.out) continue
      ghost.scared = true
      ghost.dir = OPPOSITE[ghost.dir]
    }
  }
  if (game.left === 0) {
    game.level += 1
    fillDots(game)
    resetActors(game)
    game.wait = 1500
  }
}

function moveGhost(game, ghost) {
  if (!ghost.out) {
    // Na casa: espera a vez, vai até a porta e sobe.
    if (game.time < ghost.release) return
    if (ghost.x !== DOOR.x) ghost.x += Math.sign(DOOR.x - ghost.x)
    else ghost.y -= 1
    if (ghost.y < DOOR.y) {
      ghost.out = true
      ghost.dir = Math.random() < 0.5 ? 'left' : 'right'
    }
    return
  }

  let options = Object.keys(DIRS).filter((dir) => {
    if (dir === OPPOSITE[ghost.dir]) return false
    const next = stepFrom(ghost.x, ghost.y, dir)
    return !isWall(next.x, next.y)
  })
  if (!options.length) options = [OPPOSITE[ghost.dir]]

  let dir
  if (ghost.scared) {
    dir = options[Math.floor(Math.random() * options.length)]
  } else {
    const target = ghostTarget(game, ghost)
    let bestDistance = Infinity
    for (const option of options) {
      const next = stepFrom(ghost.x, ghost.y, option)
      const distance = (next.x - target.x) ** 2 + (next.y - target.y) ** 2
      if (distance < bestDistance) {
        bestDistance = distance
        dir = option
      }
    }
  }
  const next = stepFrom(ghost.x, ghost.y, dir)
  ghost.dir = dir
  ghost.x = next.x
  ghost.y = next.y
}

// Cada fantasma tem seu jeito de perseguir; a cada 25 s, 5 s espalhados nos cantos.
function ghostTarget(game, ghost) {
  const info = GHOSTS[ghost.index]
  if ((game.time - game.modeStart) % 25_000 < 5_000) return info.corner
  const pac = game.pac
  const [dx, dy] = DIRS[pac.dir]
  if (info.name === 'pinky') return { x: pac.x + dx * 4, y: pac.y + dy * 4 }
  if (info.name === 'inky') {
    const blinky = game.ghosts[0]
    return { x: 2 * (pac.x + dx * 2) - blinky.x, y: 2 * (pac.y + dy * 2) - blinky.y }
  }
  if (info.name === 'clyde' && (ghost.x - pac.x) ** 2 + (ghost.y - pac.y) ** 2 < 64) return info.corner
  return { x: pac.x, y: pac.y }
}

function collide(game) {
  const pac = game.pac
  for (const ghost of game.ghosts) {
    if (ghost.x !== pac.x || ghost.y !== pac.y) continue
    if (ghost.scared) {
      game.score += 200 * 2 ** Math.min(game.combo, 3)
      game.combo += 1
      const home = HOUSE[1]
      Object.assign(ghost, { x: home.x, y: home.y, out: false, scared: false, release: game.time + 1500 })
      continue
    }
    game.lives -= 1
    if (game.lives <= 0) {
      game.over = true
      return
    }
    resetActors(game)
    game.wait = 1500
    return
  }
}

function pacmanKey(game, key) {
  if (DIRS[key]) {
    game.pac.want = key
    return false
  }
  if (key === 'space') {
    game.paused = true
    return true
  }
  return false
}

function pacmanRows(game) {
  const flashing = game.scaredUntil && game.scaredUntil - game.time < 2000 && Math.floor(game.time / 250) % 2 === 0
  const grid = MAZE.map((row, y) =>
    [...row].map((c, x) => {
      if (c === '#') return ['██', COLORS.dim]
      if (c === '-') return ['──', COLORS.pink]
      const item = game.dots[y][x]
      if (item === 'dot') return [' ·', COLORS.text]
      if (item === 'power') return [' ●', COLORS.orange]
      return ['  ', null]
    }),
  )
  for (const ghost of game.ghosts) {
    const color = ghost.scared ? (flashing ? COLORS.text : COLORS.blue) : GHOSTS[ghost.index].color
    grid[ghost.y][ghost.x] = ['▟▙', color]
  }
  grid[game.pac.y][game.pac.x] = ['██', COLORS.yellow]
  return grid
}

// ---------------------------------------------------------------- desenho

const RULES = {
  tetris: {
    create: newTetris,
    tick: tetrisTick,
    key: tetrisKey,
    rows: tetrisRows,
    help: ['←→ move · ↑ gira · ↓ desce', 'espaço solta · p pausa · q menu'],
  },
  snake: {
    create: newSnake,
    tick: snakeTick,
    key: snakeKey,
    rows: snakeRows,
    help: ['setas mudam a direção', 'espaço ou p pausa · q menu'],
  },
  pacman: {
    create: newPacman,
    tick: pacmanTick,
    key: pacmanKey,
    rows: pacmanRows,
    help: ['setas movem', 'espaço ou p pausa · q menu'],
  },
}

function draw(world, p, elements) {
  world.highs = (p && p.highs) || {}
  const { Box, Text } = elements
  const rows = world.screen === 'menu' ? menuRows(world, p) : gameRows(world, p)
  const root = { flexDirection: 'column' }
  if (p.bg) root.backgroundColor = p.bg
  return Box({ ...root, children: rows.map((cells) => rowText(Text, cells)) })
}

function menuRows(world, p) {
  const rows = [[['FLIPERAMA', COLORS.pink, true]], []]
  GAMES.forEach((game, i) => {
    const picked = i === world.pick
    const best = bestOf(world, p, game.id)
    rows.push([
      [picked ? '▸ ' : '  ', game.color],
      [game.name.padEnd(10), picked ? game.color : COLORS.text, picked],
      [best ? 'recorde ' + best : '', COLORS.dim],
    ])
  })
  rows.push(
    [],
    [['↑↓ escolhe · espaço joga · 1 2 3', COLORS.dim]],
    [],
    [['Clique aqui para o jogo receber', COLORS.dim]],
    [['o teclado; Esc devolve ao prompt.', COLORS.dim]],
  )
  return rows
}

function gameRows(world, p) {
  const game = world.game
  const info = GAMES[world.pick]
  const rules = RULES[game.id]
  const best = Math.max(bestOf(world, p, game.id), game.score)
  const header = [
    [info.name, info.color, true],
    ['  pontos ' + game.score, COLORS.text],
    ['  recorde ' + best, COLORS.dim],
  ]
  if (game.id === 'pacman') header.push(['  ' + '█'.repeat(Math.max(0, game.lives)), COLORS.yellow])

  let status = []
  if (game.over) {
    status = [[game.isRecord ? 'NOVO RECORDE! ' : 'FIM DE JOGO · ', COLORS.red, true], ['espaço recomeça · q menu', COLORS.text]]
  } else if (game.paused) {
    status = [['PAUSADO', COLORS.yellow, true], [' · espaço ou p continua', COLORS.text]]
  } else if (game.id === 'pacman' && game.wait > 0) {
    status = [[game.level > 1 && game.score ? 'NÍVEL ' + game.level + '!' : 'PRONTO!', COLORS.yellow, true]]
  } else if (game.id === 'pacman') {
    status = [['nível ' + game.level, COLORS.dim]]
  }

  return [header, status, ...rules.rows(game), ...rules.help.map((text) => [[text, COLORS.dim]])]
}

// Uma linha de células [texto, cor, negrito]; junta as vizinhas de mesmo estilo.
function rowText(Text, cells) {
  const runs = []
  for (const [text, color, bold] of cells) {
    if (!text) continue
    const last = runs[runs.length - 1]
    if (last && last.color === color && last.bold === bold) last.text += text
    else runs.push({ text, color, bold })
  }
  if (!runs.length) return Text({ children: ' ' })
  return Text({
    wrap: 'truncate-end',
    children: runs.map((run) => {
      if (!run.color && !run.bold) return run.text
      const props = { children: run.text }
      if (run.color) props.color = run.color
      if (run.bold) props.bold = true
      return Text(props)
    }),
  })
}

function shuffle(list) {
  const out = [...list]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// Right Panel: um painel lateral estilo OpenCode para o Claude Code.
//
// Mostra, à direita da conversa (ou acima do prompt em terminal estreito):
//   - projeto, branch e modelo
//   - sessão: duração, prompts e custo
//   - contexto usado (barra, tokens, %) e do que ele é feito
//   - limites do plano (5h / 7 dias) e quando renovam
//   - tarefas (TodoWrite ou TaskCreate/TaskUpdate)
//   - subagentes da sessão
//   - arquivos que o Claude alterou nesta sessão
//   - git: commits à frente/atrás, último commit, +/- por arquivo
//   - servidores MCP conectados (e quantas vezes cada um foi usado)
//   - atalhos de prompt e comandos rápidos
//
// E dois painéis extras: o explorador de arquivos (/explorer) e o fliperama
// (/game: Tetris, Snake e Pac-Man, desenhados por um Client em games.js).
//
// Regras da análise estática dos mods: cada chamada escrita por extenso
// ($.ns.metodo), nomes de evento como string literal, e funções que recebem $
// declaradas no topo do arquivo.

const PANE = 'right-panel'
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']
const MAX_FILES = 12
const MAX_TODOS = 15
const MAX_AGENTS = 6
const MAX_GIT_FILES = 8
const MAX_MCP = 10
const MAX_CONTEXT_ROWS = 6
const TICK_MS = 15_000
const EXPLORER = 'explorer'
const EXPLORER_HIDDEN = ['.git']
const MAX_TREE_ROWS = 500
const GAME = 'game'
const GAME_IDS = ['tetris', 'snake', 'pacman']

// Atalhos que preenchem o prompt (sem enviar) e comandos que rodam num clique.
const PROMPT_SHORTCUTS = [
  { key: 'commit', label: 'commit', text: 'Faça commit das mudanças atuais com uma mensagem descritiva.' },
  { key: 'handoff', label: 'handoff', text: 'Atualize o handoff do projeto com o estado desta sessão.' },
  { key: 'testes', label: 'testes', text: 'Rode os testes do projeto e corrija o que falhar.' },
  { key: 'revisar', label: 'revisar', text: 'Revise as mudanças ainda não commitadas e aponte problemas.' },
]
const QUICK_COMMANDS = ['compact', 'clear']

// Paletas. `dracula` usa as cores do tema Dracula com fundo próprio; `auto`
// usa as chaves de tema do Claude Code e segue o tema escolhido em /theme.
const PALETTES = {
  dracula: {
    bg: '#282a36',
    text: '#f8f8f2',
    dim: '#6272a4',
    title: '#bd93f9',
    accent: '#ff79c6',
    info: '#8be9fd',
    ok: '#50fa7b',
    warn: '#f1fa8c',
    err: '#ff5555',
  },
  auto: {
    title: 'suggestion',
    accent: 'claude',
    info: 'suggestion',
    ok: 'success',
    warn: 'warning',
    err: 'error',
  },
}

const CONTEXT_NAMES = {
  'System prompt': 'Sistema',
  'System tools': 'Ferramentas',
  'MCP tools': 'Ferramentas MCP',
  'Custom agents': 'Agentes',
  'Memory files': 'Memória',
  Skills: 'Skills',
  Messages: 'Mensagens',
}

// Estado do painel. Zera quando o módulo recarrega; reconstruído pelo transcript.
let info = { project: '', branch: '', model: '' }
let usage = { tokens: 0, window: 0, percent: 0, usd: null, limits: [], startedAt: 0 }
let now = 0
let contextRows = [] // { name, tokens }
let todos = [] // { id, text, status }
let files = new Map() // caminho -> número de edições
let mcpUsed = new Map() // chave do servidor -> { name, count }
let mcpServers = new Map() // chave do servidor -> nome como o /mcp lista
let agents = [] // AgentInfo
let git = null // { upstream, ahead, behind, last, files: [{ path, add, del }], untracked }
let turns = 0
let themeName = 'dracula'
let tickTimer = null

// Explorador: pastas abertas ('' é a raiz) e o conteúdo já lido de cada uma.
let expanded = new Set([''])
let dirEntries = new Map() // pasta relativa -> [{ name, kind }] ou { error }

// Fliperama: recordes (gravados no $.store) e o motivo, se o Client falhou.
let gameHighs = { tetris: 0, snake: 0, pacman: 0 }
let gameFault = ''
let gameFocused = false

export function register(on) {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    resetState()
    await loadTheme($)
    await rebuildFromTranscript($)
    await refreshAll($)
    await maybeAutoOpen($)
    try {
      await $.command.register({
        name: 'painel',
        description: 'Abre ou fecha o painel lateral (Right Panel); "tema dracula|auto" troca as cores',
        argumentHint: '[tema dracula|auto]',
        immediate: true,
      })
    } catch {
      // Nome já em uso: o painel continua abrindo sozinho.
    }
    try {
      await $.command.register({
        name: 'explorer',
        description: 'Abre ou fecha o explorador de arquivos do diretório (Right Panel)',
        immediate: true,
      })
    } catch {}
    try {
      await $.command.register({
        name: 'game',
        description: 'Abre ou fecha o fliperama: Tetris, Snake e Pac-Man (Right Panel)',
        immediate: true,
      })
    } catch {}
    await loadGameHighs($)
    startTicker($)
    return result
  })

  // Depois de /clear, /resume e /branch o transcript muda: recomeça a leitura.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    resetState()
    await rebuildFromTranscript($)
    await refreshAll($)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('command.run', { command: 'painel' }, async ($, e) => {
    const args = String(e.args || '').trim().split(/\s+/).filter(Boolean)
    if (args[0] === 'tema') return { text: await setTheme($, args[1]) }
    await togglePane($)
    return {}
  })

  on('command.run', { command: 'explorer' }, async ($) => {
    await toggleExplorer($)
    return {}
  })

  on('command.run', { command: 'game' }, async ($) => {
    await toggleGame($)
    return {}
  })

  // O Client do fliperama terminou uma partida: grava o recorde.
  on('ui.message', async ($, e, next) => {
    if (e.requestId !== GAME) return next(e)
    await next(e)
    if (!(await saveGameScore($, e.data))) return {}
    return { props: gameProps() }
  })

  // O Client não carregou ou quebrou: o painel mostra o motivo em vez do jogo.
  on('ui.fault', async ($, e, next) => {
    if (e.requestId === GAME) {
      gameFault = String(e.reason || 'falha no jogo')
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const ok = !result.deny && !result.isError
    if (ok && trackToolUse(e.tool, e, result)) $.ui.invalidate('ui.render')
    if (e.tool === 'Agent' && (await refreshAgents($))) $.ui.invalidate('ui.render')
    // Arquivos podem ter sido criados ou apagados: relê as pastas abertas do explorador.
    if (ok && dirEntries.size && (EDIT_TOOLS.includes(e.tool) || e.tool === 'Bash')) await refreshExplorer($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    // Um subagente terminou: só a lista de agentes muda.
    if (e.agentId) {
      if (await refreshAgents($)) $.ui.invalidate('ui.render')
      return result
    }
    turns += 1
    await refreshAll($)
    $.ui.invalidate('ui.render')
    return result
  })

  // Contexto, custo e limites mudaram.
  on('session.measure', async ($, e, next) => {
    applyUsage(e)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  // O usuário fechou o painel no ✕ ou com Ctrl+X X: lembra para a próxima sessão.
  on('ui.close', { id: PANE }, async ($, e, next) => {
    if (e.origin && e.origin.kind === 'person') await $.store.set('autoOpen', false)
    return next(e)
  })

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    const props = e.props || {}
    const bodyRows = (props.scroll && props.scroll.bodyRows) || 0
    if (e.requestId === EXPLORER) {
      const { Box, Text, Button } = $.ui.resolve(e)
      return drawExplorer($, Box, Text, Button, bodyRows)
    }
    if (e.requestId === GAME) {
      const { Box, Text, Client } = $.ui.resolve(e)
      gameFocused = props.isFocused === true
      return drawGame(Box, Text, Client, e.surface, bodyRows)
    }
    if (e.requestId !== PANE) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const columns = props.bodyColumns || 40
    return drawPanel($, Box, Text, Button, columns, bodyRows)
  })
}

// ---------------------------------------------------------------- estado

function resetState() {
  info = { project: '', branch: '', model: '' }
  usage = { tokens: 0, window: 0, percent: 0, usd: null, limits: [], startedAt: 0 }
  contextRows = []
  todos = []
  files = new Map()
  mcpUsed = new Map()
  mcpServers = new Map()
  agents = []
  git = null
  turns = 0
}

// Reaplica as chamadas de ferramenta já feitas (útil em /resume e ao recarregar o mod).
async function rebuildFromTranscript($) {
  try {
    const messages = await $.session.messages()
    for (const message of messages) {
      if (message.role === 'user' && message.text) turns += 1
      for (const use of message.toolUses || []) {
        if (use.isError) continue
        trackToolUse(use.tool, use.input || {}, { result: use.result, text: use.text })
      }
    }
  } catch {
    // Sem transcript ainda.
  }
}

// Atualiza o estado a partir de uma chamada de ferramenta. Devolve true se algo mudou.
function trackToolUse(tool, input, result) {
  if (!tool) return false

  if (tool.startsWith('mcp__')) {
    const name = tool.split('__')[1] || tool
    const key = serverKey(name)
    mcpUsed.set(key, { name, count: ((mcpUsed.get(key) || {}).count || 0) + 1 })
    return true
  }

  if (EDIT_TOOLS.includes(tool)) {
    const path = input.file_path || input.notebook_path
    if (!path) return false
    files.set(path, (files.get(path) || 0) + 1)
    return true
  }

  if (tool === 'TodoWrite' && Array.isArray(input.todos)) {
    todos = input.todos.map((t, i) => ({
      id: String(i + 1),
      text: t.status === 'in_progress' && t.activeForm ? t.activeForm : t.content || '',
      status: t.status || 'pending',
    }))
    return true
  }

  if (tool === 'TaskCreate') {
    const text = String((result && result.text) || '')
    const match = text.match(/#(\d+)/)
    const id = match ? match[1] : String(todos.length + 1)
    todos = [...todos, { id, text: input.subject || input.description || 'Tarefa', status: 'pending' }]
    return true
  }

  if (tool === 'TaskUpdate' && input.taskId != null) {
    const id = String(input.taskId)
    if (input.status === 'deleted') {
      todos = todos.filter((t) => t.id !== id)
    } else {
      todos = todos.map((t) =>
        t.id === id
          ? {
              ...t,
              status: input.status || t.status,
              text: input.status === 'in_progress' && input.activeForm ? input.activeForm : input.subject || t.text,
            }
          : t,
      )
    }
    return true
  }

  return false
}

// Tudo que muda a cada turno, lido em paralelo.
async function refreshAll($) {
  await Promise.all([
    refreshInfo($),
    refreshUsage($),
    refreshBreakdown($),
    refreshGit($),
    refreshAgents($),
  ])
}

async function refreshInfo($) {
  try {
    const cwd = await $.session.cwd()
    info.project = baseName(cwd)
  } catch {}
  try {
    info.model = await $.session.model()
  } catch {}
  const branch = await gitOut($, ['branch', '--show-current'])
  info.branch = branch == null ? '' : branch.trim()
}

async function refreshUsage($) {
  try {
    applyUsage(await $.session.usage())
  } catch {}
  await refreshClock($)
}

async function refreshClock($) {
  try {
    now = await $.clock.now()
  } catch {}
}

function applyUsage(u) {
  if (!u) return
  if (u.context) {
    usage.window = u.context.window || usage.window
    usage.tokens = u.context.tokens ?? usage.tokens
    usage.percent = Math.round(
      u.context.percent ?? (usage.window ? (usage.tokens / usage.window) * 100 : 0),
    )
  }
  if (u.cost) usage.usd = u.cost.usd
  if (Array.isArray(u.rateLimits)) usage.limits = u.rateLimits
  if (u.startedAt) usage.startedAt = u.startedAt
}

// Composição do contexto (estimada localmente, sem chamada à API) e os servidores MCP
// conectados, que aparecem nela mesmo quando as ferramentas carregam sob demanda.
async function refreshBreakdown($) {
  let breakdown = null
  try {
    const u = await $.session.usage({ breakdown: 'summary' })
    breakdown = u && u.context && u.context.breakdown
  } catch {}

  if (breakdown) {
    const window = breakdown.rawMaxTokens || usage.window
    contextRows = (breakdown.categories || [])
      .filter((c) => c.kind === 'used' && c.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .map((c) => ({ name: CONTEXT_NAMES[c.name] || c.name, tokens: c.tokens, window }))
  }

  const servers = new Map()
  for (const tool of (breakdown && breakdown.mcpTools) || []) {
    if (tool.serverName) servers.set(serverKey(tool.serverName), tool.serverName)
  }
  try {
    for (const tool of await $.tool.list()) {
      if (!tool.mcp || !tool.name.startsWith('mcp__')) continue
      const name = tool.name.split('__')[1]
      if (name && !servers.has(serverKey(name))) servers.set(serverKey(name), name)
    }
  } catch {}
  if (servers.size) mcpServers = servers
}

// Devolve true quando a lista de agentes mudou.
async function refreshAgents($) {
  try {
    const list = await $.agent.list()
    const before = JSON.stringify(agents.map((a) => [a.id, a.status]))
    agents = list
    return before !== JSON.stringify(agents.map((a) => [a.id, a.status]))
  } catch {
    return false
  }
}

// Roda `git <args>` no diretório da sessão. Devolve o stdout, ou null se falhou.
async function gitOut($, args) {
  try {
    const run = await $.process.run(['git', ...args])
    return run.exitCode === 0 ? run.stdout : null
  } catch {
    return null
  }
}

async function refreshGit($) {
  const [log, counts, numstat, status] = await Promise.all([
    gitOut($, ['log', '-1', '--format=%h %s']),
    gitOut($, ['rev-list', '--left-right', '--count', 'HEAD...@{u}']),
    gitOut($, ['diff', '--numstat', 'HEAD']),
    gitOut($, ['status', '--porcelain']),
  ])
  // Fora de um repositório (ou sem nenhum commit): sem seção Git.
  if (log == null) {
    git = null
    return
  }

  const [ahead, behind] = String(counts || '').trim().split(/\s+/).map(Number)
  const changed = []
  for (const row of String(numstat || '').split('\n')) {
    const parts = row.split('\t')
    if (parts.length < 3) continue
    changed.push({ path: parts.slice(2).join('\t'), add: parts[0], del: parts[1] })
  }
  const untracked = String(status || '').split('\n').filter((l) => l.startsWith('??')).length

  git = {
    upstream: counts != null && Number.isFinite(ahead) && Number.isFinite(behind),
    ahead: ahead || 0,
    behind: behind || 0,
    last: log.trim(),
    files: changed,
    untracked,
  }
}

// Um relógio para a duração da sessão, a contagem dos limites e o estado dos subagentes.
function startTicker($) {
  if (tickTimer) tickTimer.cancel()
  try {
    tickTimer = $.clock.every(TICK_MS, () => tick($))
  } catch {
    tickTimer = null
  }
}

async function tick($) {
  await refreshClock($)
  await refreshAgents($)
  $.ui.invalidate('ui.render')
}

// ---------------------------------------------------------------- tema

async function loadTheme($) {
  try {
    const saved = await $.store.get('theme')
    if (typeof saved === 'string' && PALETTES[saved]) themeName = saved
  } catch {}
}

async function setTheme($, name) {
  if (!PALETTES[name]) return 'Temas: ' + Object.keys(PALETTES).join(', ') + ' (atual: ' + themeName + ')'
  themeName = name
  await $.store.set('theme', name)
  $.ui.invalidate('ui.render')
  return 'Tema do painel: ' + name
}

function palette() {
  return PALETTES[themeName] || PALETTES.dracula
}

// Props de Text para um estilo: text, dim, title, accent, info, ok, warn, err.
function styled(style) {
  const p = palette()
  if (style === 'dim') return p.dim ? { color: p.dim } : { dimColor: true }
  if (style === 'title') return { bold: true, color: p.title }
  if (style && p[style]) return { color: p[style] }
  return p.text ? { color: p.text } : {}
}

// Fundo da paleta preenchendo a área do painel.
function rootProps(bodyRows) {
  const p = palette()
  const props = { flexDirection: 'column', paddingX: 1 }
  if (p.bg) {
    props.backgroundColor = p.bg
    if (bodyRows) props.minHeight = bodyRows
  }
  return props
}

// ---------------------------------------------------------------- painel

async function maybeAutoOpen($) {
  const auto = await $.store.get('autoOpen')
  if (auto === false) return
  await $.ui.open({ id: PANE, title: 'Sessão' })
}

async function togglePane($) {
  // Aberto mas esperando um terminal mais largo conta como fechado: o /painel força a abertura.
  const isOpen = (await $.ui.panes()).some((pane) => pane.id === PANE && pane.isPlaced !== false)
  if (isOpen) {
    await $.ui.close({ id: PANE })
    await $.store.set('autoOpen', false)
  } else {
    await $.ui.open({ id: PANE, title: 'Sessão' })
    await $.store.set('autoOpen', true)
  }
}

async function fillPrompt($, text) {
  try {
    const filled = await $.prompt.fill({ text, mode: 'replace' })
    if (!filled.isFilled) $.ui.toast('O prompt não pôde ser preenchido agora')
  } catch {
    $.ui.toast('O prompt não pôde ser preenchido agora')
  }
}

async function runCommand($, command) {
  try {
    await $.command.run({ command })
  } catch (err) {
    $.ui.toast('/' + command + ': ' + String((err && err.message) || err))
  }
}

function drawPanel($, Box, Text, Button, columns, bodyRows) {
  const width = Math.max(20, columns)
  const rows = []
  const line = (text, style, extra) =>
    rows.push(Text({ wrap: 'truncate-end', ...styled(style), ...extra, children: text }))
  const gap = () => rows.push(Text({ children: ' ' }))
  const title = (text) => {
    gap()
    line(text, 'title')
  }

  // Cabeçalho
  line(info.project || 'Sessão', 'text', { bold: true })
  const sub = [info.branch && '⎇ ' + info.branch, info.model].filter(Boolean).join('  ·  ')
  if (sub) line(sub, 'dim')

  // Sessão: duração, prompts e custo
  title('Sessão')
  const facts = []
  if (usage.startedAt && now > usage.startedAt) facts.push('⏱ ' + duration(now - usage.startedAt))
  if (turns) facts.push(turns + (turns === 1 ? ' prompt' : ' prompts'))
  if (facts.length) line(facts.join('  ·  '), 'text')
  if (usage.usd != null) line('Custo: US$ ' + usage.usd.toFixed(2), 'text')

  // Contexto e do que ele é feito
  title('Contexto')
  if (usage.window) {
    const barWidth = Math.min(24, width - 8)
    line(bar(usage.percent, barWidth) + ' ' + usage.percent + '%', levelStyle(usage.percent))
    line(short(usage.tokens) + ' / ' + short(usage.window) + ' tokens', 'dim')
  } else {
    line('aguardando a primeira resposta', 'dim')
  }
  for (const row of contextRows.slice(0, MAX_CONTEXT_ROWS)) {
    const pct = row.window ? Math.round((row.tokens / row.window) * 100) : 0
    line(row.name.slice(0, 15).padEnd(16) + short(row.tokens).padStart(6) + '  ' + pct + '%', 'dim')
  }

  // Limites do plano e quando renovam
  if (usage.limits.length) {
    title('Limites')
    for (const limit of usage.limits) {
      const pct = Math.round(limit.percentUsed)
      const reset = resetIn(limit.resetsAt)
      line(
        limitLabel(limit.kind).padEnd(7) + bar(pct, 10) + ' ' + String(pct + '%').padEnd(4) + (reset ? ' ↻ ' + reset : ''),
        levelStyle(pct),
      )
    }
  }

  // Tarefas
  if (todos.length) {
    const done = todos.filter((t) => t.status === 'completed').length
    title('Tarefas  ' + done + '/' + todos.length)
    for (const t of todos.slice(0, MAX_TODOS)) {
      const mark = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▶' : '○'
      const style = t.status === 'completed' ? 'dim' : t.status === 'in_progress' ? 'warn' : 'text'
      line(mark + ' ' + t.text, style)
    }
    if (todos.length > MAX_TODOS) line('… +' + (todos.length - MAX_TODOS), 'dim')
  }

  // Subagentes: os ativos primeiro
  if (agents.length) {
    const active = agents.filter((a) => isActive(a.status))
    title('Subagentes  ' + active.length + ' ativo' + (active.length === 1 ? '' : 's'))
    const list = [...active, ...agents.filter((a) => !isActive(a.status)).reverse()].slice(0, MAX_AGENTS)
    for (const agent of list) {
      const [mark, style] = agentMark(agent.status)
      line(mark + ' ' + (agent.description || agent.type) + '  · ' + agent.type, style)
    }
    if (agents.length > MAX_AGENTS) line('… +' + (agents.length - MAX_AGENTS), 'dim')
  }

  // Arquivos alterados
  if (files.size) {
    title('Arquivos alterados  ' + files.size)
    const list = [...files.entries()].slice(-MAX_FILES).reverse()
    for (const [path, count] of list) {
      line('• ' + baseName(path) + (count > 1 ? '  ×' + count : ''), 'text')
    }
    if (files.size > MAX_FILES) line('… +' + (files.size - MAX_FILES), 'dim')
  }

  // Git
  if (git) {
    title('Git')
    const sync = git.upstream
      ? '↑' + git.ahead + ' ↓' + git.behind + (git.ahead || git.behind ? '' : '  em dia')
      : 'sem upstream'
    line(sync, git.behind ? 'warn' : git.ahead ? 'info' : 'ok')
    line(git.last, 'dim')
    for (const f of git.files.slice(0, MAX_GIT_FILES)) {
      const delta = f.add === '-' ? 'bin' : '+' + f.add + ' −' + f.del
      line(delta.padEnd(10) + baseName(f.path), 'text')
    }
    if (git.files.length > MAX_GIT_FILES) line('… +' + (git.files.length - MAX_GIT_FILES), 'dim')
    if (git.untracked) line('? ' + git.untracked + ' não rastreado' + (git.untracked === 1 ? '' : 's'), 'dim')
    if (!git.files.length && !git.untracked) line('nada a commitar', 'dim')
  }

  // MCP: conectados e quantas vezes cada um foi usado
  const servers = new Map(mcpServers)
  for (const [key, used] of mcpUsed) if (!servers.has(key)) servers.set(key, used.name)
  const uses = (key) => (mcpUsed.get(key) || {}).count || 0
  if (servers.size) {
    title('MCP  ' + servers.size)
    const list = [...servers.entries()].sort((a, b) => uses(b[0]) - uses(a[0]))
    for (const [key, name] of list.slice(0, MAX_MCP)) {
      const count = uses(key)
      line((count ? '● ' : '○ ') + serverLabel(name) + (count ? '  ' + count : ''), count ? 'ok' : 'dim')
    }
    if (servers.size > MAX_MCP) line('… +' + (servers.size - MAX_MCP), 'dim')
  }

  // Ações
  title('Atalhos')
  rows.push(
    Box({
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 1,
      children: PROMPT_SHORTCUTS.map((s) =>
        Button({ key: 'prompt:' + s.key, label: s.label, onPress: () => fillPrompt($, s.text) }),
      ),
    }),
  )
  rows.push(
    Box({
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 1,
      children: QUICK_COMMANDS.map((c) =>
        Button({ key: 'cmd:' + c, label: '/' + c, variant: 'secondary', onPress: () => runCommand($, c) }),
      ),
    }),
  )

  gap()
  line('/painel abre e fecha · /painel tema', 'dim')

  return Box({ ...rootProps(bodyRows), children: rows })
}

// ---------------------------------------------------------------- explorador

async function toggleExplorer($) {
  const isOpen = (await $.ui.panes()).some((pane) => pane.id === EXPLORER && pane.isPlaced !== false)
  if (isOpen) {
    await $.ui.close({ id: EXPLORER })
    return
  }
  try {
    info.project = info.project || baseName(await $.session.cwd())
  } catch {}
  await refreshExplorer($)
  await $.ui.open({ id: EXPLORER, title: 'Explorer' })
}

// Lê uma pasta (relativa ao diretório de trabalho): pastas primeiro, depois arquivos, por nome.
async function loadDir($, dir) {
  try {
    const list = dir ? await $.fs.list(dir) : await $.fs.list()
    const entries = list
      .filter((entry) => !EXPLORER_HIDDEN.includes(entry.name))
      .map((entry) => ({ name: entry.name, kind: entry.kind === 'dir' ? 'dir' : 'file' }))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
    dirEntries.set(dir, entries)
  } catch (err) {
    dirEntries.set(dir, { error: String((err && err.message) || err) })
  }
}

// Relê todas as pastas abertas.
async function refreshExplorer($) {
  dirEntries = new Map()
  for (const dir of expanded) await loadDir($, dir)
  $.ui.invalidate('ui.render')
}

async function toggleDir($, dir) {
  if (expanded.has(dir)) {
    expanded.delete(dir)
  } else {
    expanded.add(dir)
    if (!dirEntries.has(dir)) await loadDir($, dir)
  }
  $.ui.invalidate('ui.render')
}

async function collapseAll($) {
  expanded = new Set([''])
  $.ui.invalidate('ui.render')
}

async function copyPath($, path, surface) {
  const copied = await $.ui.copy({ text: path, surface })
  if (copied && copied.isCopied) $.ui.toast('Copiado: ' + path)
}

// Monta as linhas da árvore, descendo só nas pastas abertas.
function treeRows(dir, depth, rows) {
  const entries = dirEntries.get(dir)
  if (!entries) return
  if (!Array.isArray(entries)) {
    rows.push({ kind: 'error', depth, name: entries.error })
    return
  }
  for (const entry of entries) {
    if (rows.length >= MAX_TREE_ROWS) return
    const path = dir ? dir + '/' + entry.name : entry.name
    const isOpen = entry.kind === 'dir' && expanded.has(path)
    rows.push({ kind: entry.kind, depth, name: entry.name, path, isOpen })
    if (isOpen) treeRows(path, depth + 1, rows)
  }
}

function drawExplorer($, Box, Text, Button, bodyRows) {
  const rows = []
  treeRows('', 0, rows)
  const items = []

  items.push(
    Box({
      flexDirection: 'row',
      children: [
        Text({ bold: true, wrap: 'truncate-end', ...styled('text'), children: info.project || '.' }),
        Text({ children: '  ' }),
        Button({ key: 'explorer:refresh', label: '↻', plain: true, hotkey: 'r', onPress: () => refreshExplorer($) }),
        Text({ children: ' ' }),
        Button({ key: 'explorer:collapse', label: '⊟', plain: true, hotkey: 'c', onPress: () => collapseAll($) }),
      ],
    }),
  )

  if (!rows.length) items.push(Text({ ...styled('dim'), children: 'pasta vazia' }))

  for (const row of rows) {
    const indent = '  '.repeat(row.depth)
    if (row.kind === 'error') {
      items.push(Text({ ...styled('err'), wrap: 'truncate-end', children: indent + row.name }))
    } else if (row.kind === 'dir') {
      items.push(
        Button({
          key: 'dir:' + row.path,
          label: indent + (row.isOpen ? '▾ ' : '▸ ') + row.name,
          plain: true,
          onPress: () => toggleDir($, row.path),
        }),
      )
    } else {
      items.push(
        Button({
          key: 'file:' + row.path,
          label: indent + '  ' + row.name,
          plain: true,
          dimColor: true,
          onPress: (press) => copyPath($, row.path, press.surface),
        }),
      )
    }
  }

  if (rows.length >= MAX_TREE_ROWS) items.push(Text({ ...styled('dim'), children: '… lista cortada em ' + MAX_TREE_ROWS }))
  items.push(Text({ children: ' ' }))
  items.push(
    Text({ ...styled('dim'), wrap: 'truncate-end', children: 'clique: abre pasta / copia caminho · r atualiza · c recolhe' }),
  )

  return Box({ ...rootProps(bodyRows), children: items })
}

// ---------------------------------------------------------------- fliperama

async function toggleGame($) {
  const isOpen = (await $.ui.panes()).some((pane) => pane.id === GAME && pane.isPlaced !== false)
  if (isOpen) {
    await $.ui.close({ id: GAME })
    return
  }
  gameFault = ''
  await $.ui.open({ id: GAME, title: 'Fliperama', focus: true, columns: 44, rows: 28 })
}

async function loadGameHighs($) {
  try {
    const saved = await $.store.get('gameHighs')
    if (saved && typeof saved === 'object') {
      for (const id of GAME_IDS) gameHighs[id] = Math.max(0, Number(saved[id]) || 0)
    }
  } catch {}
}

// Os dados vêm do código do Client: confere antes de gravar. Devolve true se é recorde novo.
async function saveGameScore($, data) {
  if (!data || data.type !== 'score' || !GAME_IDS.includes(data.game)) return false
  const score = Math.floor(Number(data.score))
  if (!Number.isFinite(score) || score <= (gameHighs[data.game] || 0)) return false
  gameHighs = { ...gameHighs, [data.game]: score }
  try {
    await $.store.set('gameHighs', gameHighs)
  } catch {}
  return true
}

function gameProps() {
  const props = { highs: gameHighs, focused: gameFocused }
  const bg = palette().bg
  if (bg) props.bg = bg
  return props
}

function drawGame(Box, Text, Client, surface, bodyRows) {
  // Só o terminal e o desktop desenham um Client (o VS Code e o celular, não).
  const message = gameFault
    ? 'O fliperama falhou: ' + gameFault
    : surface !== 'terminal' && surface !== 'desktop'
      ? 'O fliperama só roda no Claude Code do terminal.'
      : ''
  if (message) {
    return Box({
      ...rootProps(bodyRows),
      children: [
        Text({ ...styled('err'), children: message }),
        Text({ ...styled('dim'), children: '/game fecha este painel' }),
      ],
    })
  }
  return Box({
    ...rootProps(bodyRows),
    children: [Client({ key: 'fliperama', module: './games.js', props: gameProps() })],
  })
}

// ---------------------------------------------------------------- utilitários

function bar(percent, width) {
  const p = Math.max(0, Math.min(100, percent || 0))
  const filled = Math.round((p / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function levelStyle(percent) {
  if (percent >= 85) return 'err'
  if (percent >= 60) return 'warn'
  return 'ok'
}

function limitLabel(kind) {
  if (kind === 'five_hour') return '5h'
  if (kind === 'seven_day') return '7 dias'
  if (kind === 'spend_limit') return 'gasto'
  return kind
}

function isActive(status) {
  return status === 'pending' || status === 'running' || status === 'waiting' || status === 'idle'
}

function agentMark(status) {
  if (status === 'running') return ['▶', 'warn']
  if (status === 'pending' || status === 'waiting') return ['…', 'info']
  if (status === 'idle') return ['⏸', 'info']
  if (status === 'failed') return ['✗', 'err']
  if (status === 'killed') return ['■', 'dim']
  return ['✓', 'dim']
}

// Chave comum ao nome do /mcp ("claude.ai Gmail") e ao do prefixo da ferramenta ("claude_ai_Gmail").
function serverKey(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function serverLabel(name) {
  const text = String(name)
  if (text.startsWith('plugin:')) return text.split(':').pop()
  return text.replace(/^claude\.ai /, '').replace(/^claude_ai_/, '').replace(/_/g, ' ')
}

// "2h 05min", "12min", "menos de 1min".
function duration(ms) {
  const minutes = Math.floor(ms / 60_000)
  if (minutes < 1) return 'menos de 1min'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? h + 'h ' + String(m).padStart(2, '0') + 'min' : m + 'min'
}

// Quanto falta para um limite renovar: "2h10", "35min", "3d".
function resetIn(resetsAt) {
  if (!resetsAt || !now) return ''
  const at = Date.parse(resetsAt)
  if (!Number.isFinite(at) || at <= now) return ''
  const minutes = Math.ceil((at - now) / 60_000)
  if (minutes >= 48 * 60) return Math.round(minutes / 1440) + 'd'
  if (minutes >= 60) return Math.floor(minutes / 60) + 'h' + String(minutes % 60).padStart(2, '0')
  return minutes + 'min'
}

function baseName(path) {
  const parts = String(path || '').split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] || String(path || '')
}

function short(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k'
  return String(n || 0)
}

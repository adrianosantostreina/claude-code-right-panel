// Right Panel: um painel lateral estilo OpenCode para o Claude Code.
//
// Mostra, à direita da conversa (ou acima do prompt em terminal estreito):
//   - projeto, branch e modelo
//   - contexto usado (barra, tokens, %) e custo da sessão
//   - limites do plano (5h / 7 dias)
//   - tarefas (TodoWrite ou TaskCreate/TaskUpdate)
//   - arquivos que o Claude alterou nesta sessão
//   - servidores MCP usados nesta sessão
//
// Regras da análise estática dos mods: cada chamada escrita por extenso
// ($.ns.metodo), nomes de evento como string literal, e funções que recebem $
// declaradas no topo do arquivo.

const PANE = 'right-panel'
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit', 'NotebookEdit']
const MAX_FILES = 12
const MAX_TODOS = 15
const EXPLORER = 'explorer'
const EXPLORER_HIDDEN = ['.git']
const MAX_TREE_ROWS = 500

// Estado do painel. Zera quando o módulo recarrega; reconstruído pelo transcript.
let info = { project: '', branch: '', model: '' }
let usage = { tokens: 0, window: 0, percent: 0, usd: null, limits: [] }
let todos = [] // { id, text, status }
let files = new Map() // caminho -> número de edições
let mcp = new Map() // servidor -> número de chamadas
let turns = 0

// Explorador: pastas abertas ('' é a raiz) e o conteúdo já lido de cada uma.
let expanded = new Set([''])
let dirEntries = new Map() // pasta relativa -> [{ name, kind }] ou { error }

export function register(on) {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    resetState()
    await rebuildFromTranscript($)
    await refreshInfo($)
    await refreshUsage($)
    await maybeAutoOpen($)
    try {
      await $.command.register({
        name: 'painel',
        description: 'Abre ou fecha o painel lateral (Right Panel)',
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
    return result
  })

  // Depois de /clear, /resume e /branch o transcript muda: recomeça a leitura.
  on('classic.SessionStart', { source: ['clear', 'resume', 'fork'] }, async ($, e, next) => {
    resetState()
    await rebuildFromTranscript($)
    await refreshInfo($)
    await refreshUsage($)
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('command.run', { command: 'painel' }, async ($) => {
    await togglePane($)
    return {}
  })

  on('command.run', { command: 'explorer' }, async ($) => {
    await toggleExplorer($)
    return {}
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)
    const ok = !result.deny && !result.isError
    if (ok && trackToolUse(e.tool, e, result)) $.ui.invalidate('ui.render')
    // Arquivos podem ter sido criados ou apagados: relê as pastas abertas do explorador.
    if (ok && dirEntries.size && (EDIT_TOOLS.includes(e.tool) || e.tool === 'Bash')) await refreshExplorer($)
    return result
  })

  on('turn.complete', async ($, e, next) => {
    const result = await next(e)
    if (e.agentId) return result
    turns += 1
    await refreshInfo($)
    await refreshUsage($)
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
    if (e.requestId === EXPLORER) {
      const { Box, Text, Button } = $.ui.resolve(e)
      return drawExplorer($, Box, Text, Button)
    }
    if (e.requestId !== PANE) return next(e)
    const { Box, Text } = $.ui.resolve(e)
    const columns = (e.props && e.props.bodyColumns) || 40
    return drawPanel(Box, Text, columns)
  })
}

// ---------------------------------------------------------------- estado

function resetState() {
  info = { project: '', branch: '', model: '' }
  usage = { tokens: 0, window: 0, percent: 0, usd: null, limits: [] }
  todos = []
  files = new Map()
  mcp = new Map()
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
    const server = tool.split('__')[1] || tool
    mcp.set(server, (mcp.get(server) || 0) + 1)
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

async function refreshInfo($) {
  try {
    const cwd = await $.session.cwd()
    info.project = baseName(cwd)
  } catch {}
  try {
    info.model = await $.session.model()
  } catch {}
  try {
    const git = await $.process.run(['git', 'branch', '--show-current'])
    info.branch = git.exitCode === 0 ? git.stdout.trim() : ''
  } catch {
    info.branch = ''
  }
}

async function refreshUsage($) {
  try {
    applyUsage(await $.session.usage())
    $.ui.invalidate('ui.render')
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

function drawPanel(Box, Text, columns) {
  const width = Math.max(20, columns)
  const rows = []
  const line = (text, props) => rows.push(Text({ wrap: 'truncate-end', ...props, children: text }))
  const gap = () => rows.push(Text({ children: ' ' }))
  const title = (text) => {
    gap()
    line(text, { bold: true, color: 'cyan' })
  }

  // Cabeçalho
  line(info.project || 'Sessão', { bold: true })
  const sub = [info.branch && '⎇ ' + info.branch, info.model].filter(Boolean).join('  ·  ')
  if (sub) line(sub, { dimColor: true })

  // Contexto
  title('Contexto')
  if (usage.window) {
    const barWidth = Math.min(24, width - 8)
    line(bar(usage.percent, barWidth) + ' ' + usage.percent + '%', { color: colorFor(usage.percent) })
    line(short(usage.tokens) + ' / ' + short(usage.window) + ' tokens', { dimColor: true })
  } else {
    line('aguardando a primeira resposta', { dimColor: true })
  }
  if (usage.usd != null) line('Custo: US$ ' + usage.usd.toFixed(2))
  if (turns) line('Prompts: ' + turns, { dimColor: true })

  // Limites do plano
  if (usage.limits.length) {
    title('Limites')
    for (const limit of usage.limits) {
      const pct = Math.round(limit.percentUsed)
      line(limitLabel(limit.kind).padEnd(7) + bar(pct, 10) + ' ' + pct + '%', { color: colorFor(pct) })
    }
  }

  // Tarefas
  if (todos.length) {
    const done = todos.filter((t) => t.status === 'completed').length
    title('Tarefas  ' + done + '/' + todos.length)
    for (const t of todos.slice(0, MAX_TODOS)) {
      const mark = t.status === 'completed' ? '✓' : t.status === 'in_progress' ? '▶' : '○'
      const props =
        t.status === 'completed' ? { dimColor: true } : t.status === 'in_progress' ? { color: 'yellow' } : {}
      line(mark + ' ' + t.text, props)
    }
    if (todos.length > MAX_TODOS) line('… +' + (todos.length - MAX_TODOS), { dimColor: true })
  }

  // Arquivos alterados
  if (files.size) {
    title('Arquivos alterados  ' + files.size)
    const list = [...files.entries()].slice(-MAX_FILES).reverse()
    for (const [path, count] of list) {
      line('• ' + baseName(path) + (count > 1 ? '  ×' + count : ''))
    }
    if (files.size > MAX_FILES) line('… +' + (files.size - MAX_FILES), { dimColor: true })
  }

  // MCP
  if (mcp.size) {
    title('MCP usados')
    for (const [server, count] of mcp.entries()) {
      line('● ' + server.replace(/^claude_ai_/, '').replace(/_/g, ' ') + '  ' + count, { color: 'green' })
    }
  }

  gap()
  line('/painel abre e fecha', { dimColor: true })

  return Box({ flexDirection: 'column', paddingX: 1, children: rows })
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

function drawExplorer($, Box, Text, Button) {
  const rows = []
  treeRows('', 0, rows)
  const items = []

  items.push(
    Box({
      flexDirection: 'row',
      children: [
        Text({ bold: true, wrap: 'truncate-end', children: info.project || '.' }),
        Text({ children: '  ' }),
        Button({ key: 'explorer:refresh', label: '↻', plain: true, hotkey: 'r', onPress: () => refreshExplorer($) }),
        Text({ children: ' ' }),
        Button({ key: 'explorer:collapse', label: '⊟', plain: true, hotkey: 'c', onPress: () => collapseAll($) }),
      ],
    }),
  )

  if (!rows.length) items.push(Text({ dimColor: true, children: 'pasta vazia' }))

  for (const row of rows) {
    const indent = '  '.repeat(row.depth)
    if (row.kind === 'error') {
      items.push(Text({ color: 'red', wrap: 'truncate-end', children: indent + row.name }))
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

  if (rows.length >= MAX_TREE_ROWS) items.push(Text({ dimColor: true, children: '… lista cortada em ' + MAX_TREE_ROWS }))
  items.push(Text({ children: ' ' }))
  items.push(Text({ dimColor: true, wrap: 'truncate-end', children: 'clique: abre pasta / copia caminho · r atualiza · c recolhe' }))

  return Box({ flexDirection: 'column', paddingX: 1, children: items })
}

// ---------------------------------------------------------------- utilitários

function bar(percent, width) {
  const p = Math.max(0, Math.min(100, percent || 0))
  const filled = Math.round((p / 100) * width)
  return '█'.repeat(filled) + '░'.repeat(width - filled)
}

function colorFor(percent) {
  if (percent >= 85) return 'red'
  if (percent >= 60) return 'yellow'
  return 'green'
}

function limitLabel(kind) {
  if (kind === 'five_hour') return '5h'
  if (kind === 'seven_day') return '7 dias'
  if (kind === 'spend_limit') return 'gasto'
  return kind
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

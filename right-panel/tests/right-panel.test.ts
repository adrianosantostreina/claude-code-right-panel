import { expect, test } from 'claude-code/testing'

// O que o Claude Code passa ao ui.render do painel
const PANE = {
  plugin: 'right-panel',
  component: 'Pane',
  requestId: 'right-panel',
  viewport: { columns: 180, rows: 40 },
  props: {
    title: 'Sessão',
    isFocused: false,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

// Stubs de tudo que o session.start do mod chama
function stubSession(on, opens: unknown[], saved = new Map<string, unknown>(), overrides: Record<string, unknown> = {}) {
  const stub = (event: string, fn: unknown) => on(event, overrides[event] || fn)
  on('session.start', () => ({ cwd: '/work/meu-projeto' }))
  on('session.messages', () => ({ value: [] }))
  on('session.cwd', () => ({ value: '/work/meu-projeto' }))
  on('session.model', () => ({ value: 'Opus 5.5' }))
  stub('session.usage', () => ({
    value: {
      context: { tokens: 50_000, window: 200_000, percent: 25 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 40 }],
      cost: { usd: 1.234 },
    },
  }))
  on('process.run', ($, e) => {
    const args = e.argv.slice(1).join(' ')
    const out = (stdout: string) => ({ value: { exitCode: 0, stdout, stderr: '' } })
    if (args === 'branch --show-current') return out('main\n')
    if (args.startsWith('log -1')) return out('cf8940f feat: explorer\n')
    if (args.startsWith('rev-list')) return out('2\t0\n')
    if (args.startsWith('diff --numstat')) return out('12\t3\tright-panel/hooks/register.js\n')
    if (args.startsWith('status --porcelain')) return out(' M right-panel/hooks/register.js\n?? novo.txt\n')
    return { value: { exitCode: 1, stdout: '', stderr: '' } }
  })
  stub('env.get', () => ({ value: undefined }))
  on('clock.now', () => ({ value: Date.parse('2026-10-14T12:00:00Z') }))
  on('clock.every', () => ({ value: undefined }))
  stub('agent.list', () => ({ value: [] }))
  on('tool.list', () => ({ value: [] }))
  on('store.get', ($, e) => ({ value: saved.get(e.key) }))
  on('store.set', ($, e) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    opens.push(e)
    return { value: { isPlaced: true } }
  })
  on('command.register', () => ({ value: undefined }))
  on('tool.call', () => ({ result: 'ok', text: 'Task #7 created successfully' }))
}

async function start($) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work/meu-projeto' })
}

test('abre o painel sozinho e mostra projeto, branch, contexto e custo', async ($, on) => {
  const opens: unknown[] = []
  stubSession(on, opens)
  await start($)
  expect(opens.length).toBe(1)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'meu-projeto' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /main/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '50.0k / 200.0k tokens' })).toBeDefined()
  // com a faixa ligada (padrão), modelo, barra do contexto e limites moram nela
  expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /25%$/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^5h/ })).toBeUndefined()
})

test('faixa ligada tira modelo, barra e limites do painel; /rodape off os devolve; no VS Code ficam', async ($, on) => {
  const saved = new Map<string, unknown>()
  stubSession(on, [], saved)
  await start($)
  const duplicated = async (ui) => [
    await ui.find({ type: 'Text', text: 'Opus 5.5' }),
    await ui.find({ type: 'Text', text: /25%$/ }),
    await ui.find({ type: 'Text', text: /^5h/ }),
  ]

  const vscode = await $.ui.mount({ ...PANE, surface: 'vscode' })
  expect((await duplicated(vscode)).every((found) => found !== undefined)).toBe(true)
  await vscode.unmount()

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await duplicated(ui)).every((found) => found === undefined)).toBe(true)
  await ui.unmount()

  await $.command.run({ command: 'rodape', args: 'off' })
  const back = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await duplicated(back)).every((found) => found !== undefined)).toBe(true)
  await back.unmount()

  await $.command.run({ command: 'rodape', args: 'on' })
  const again = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await duplicated(again)).every((found) => found === undefined)).toBe(true)
})

test('ordem: projeto, branch, modelo, atalhos em grade e, no fim, relógio e calendário', async ($, on) => {
  stubSession(on, [])
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const tree = JSON.stringify(await ui.drawn())
  const at = (text: string) => tree.indexOf(text)
  expect(at('meu-projeto')).toBeGreaterThan(-1)
  expect(at('meu-projeto')).toBeLessThan(at('⎇ main'))
  expect(at('⎇ main')).toBeLessThan(at('Atalhos'))
  expect(at('Atalhos')).toBeLessThan(at('Contexto'))
  expect(at('Contexto')).toBeLessThan(at('Git'))
  expect(at('Git')).toBeLessThan(at('relogio'))
  expect(at('relogio')).toBeLessThan(at('Calendário'))
  for (const key of ['prompt:handoff', 'prompt:ler-handoff', 'open:explorer', 'open:game']) {
    expect(await ui.find({ type: 'Button', key })).toBeDefined()
  }
  // sem o que saiu do painel
  expect(await ui.find({ type: 'Text', text: /\/painel abre e fecha/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /Arquivos alterados/ })).toBeUndefined()
  expect(await ui.find({ key: 'prompt:commit' })).toBeUndefined()
  expect(await ui.find({ key: 'cmd:compact' })).toBeUndefined()
})

test('não abre sozinho quando o usuário fechou antes', async ($, on) => {
  const opens: unknown[] = []
  stubSession(on, opens, new Map([['autoOpen', false]]))
  await start($)
  expect(opens.length).toBe(0)
})

test('lista tarefas e MCPs usados, com a lista de MCPs atrás de uma seta', async ($, on) => {
  const saved = new Map<string, unknown>()
  stubSession(on, [], saved)
  await start($)

  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Escrever testes', status: 'completed', activeForm: 'Escrevendo testes' },
      { content: 'Montar painel', status: 'in_progress', activeForm: 'Montando painel' },
      { content: 'Publicar', status: 'pending', activeForm: 'Publicando' },
    ],
  })
  await $.tool.call({ tool: 'mcp__claude_ai_Gmail__search_threads', query: 'x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Tarefas  1/3' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '▶ Montando painel' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^MCP  1/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '● Gmail  1' })).toBeUndefined()

  await ui.press({ key: 'toggle:mcp' })
  expect(await ui.find({ type: 'Text', text: '● Gmail  1' })).toBeDefined()
  expect(saved.get('sections')).toEqual({ context: false, mcp: true, calendar: true })

  await ui.press({ key: 'toggle:mcp' })
  expect(await ui.find({ type: 'Text', text: '● Gmail  1' })).toBeUndefined()
})

test('acompanha TaskCreate e TaskUpdate', async ($, on) => {
  stubSession(on, [])
  await start($)

  await $.tool.call({ tool: 'TaskCreate', subject: 'Revisar código', description: 'x' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '7', status: 'completed' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Tarefas  1/1' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '✓ Revisar código' })).toBeDefined()
})

test('/painel fecha o painel aberto e grava a preferência', async ($, on) => {
  const saved = new Map<string, unknown>()
  stubSession(on, [], saved)
  on('ui.panes', () => ({ value: [{ id: 'right-panel', title: 'Sessão', isShown: true, isFocused: false, isPlaced: true }] }))
  on('ui.close', () => ({ value: undefined }))
  await start($)

  await $.command.run({ command: 'painel', args: '' })
  expect(saved.get('autoOpen')).toBe(false)
})

const EXPLORER_PANE = { ...PANE, requestId: 'explorer', props: { ...PANE.props, title: 'Explorer' } } as const

function stubFs(on) {
  const tree: Record<string, { name: string; kind: string }[]> = {
    '': [
      { name: 'README.md', kind: 'file' },
      { name: 'src', kind: 'dir' },
      { name: '.git', kind: 'dir' },
    ],
    src: [{ name: 'app.ts', kind: 'file' }],
  }
  // Sem caminho, o engine passa o diretório de trabalho absoluto.
  on('fs.list', ($, e) => {
    const path = String(e.path).replace(/\\/g, '/')
    const dir = path === 'src' || path.endsWith('/src') ? 'src' : ''
    return { value: tree[dir].map((x) => ({ ...x, size: 0, mtimeMs: 0, isLink: false })) }
  })
}

for (const surface of ['terminal', 'desktop'] as const) {
  test('/explorer abre a árvore e expande pasta no clique (' + surface + ')', async ($, on) => {
    const opens: { id?: string }[] = []
    stubSession(on, opens as unknown[])
    stubFs(on)
    on('ui.panes', () => ({ value: [] }))
    await start($)

    await $.command.run({ command: 'explorer', args: '' })
    expect(opens.some((o) => o.id === 'explorer')).toBe(true)

    const ui = await $.ui.mount({ ...EXPLORER_PANE, surface })
    expect(await ui.find({ key: 'dir:src' })).toBeDefined()
    expect(await ui.find({ key: 'file:README.md' })).toBeDefined()
    expect(await ui.find({ key: 'dir:.git' })).toBeUndefined()
    expect(await ui.find({ key: 'file:src/app.ts' })).toBeUndefined()

    await ui.press({ key: 'dir:src' })
    expect(await ui.find({ key: 'file:src/app.ts' })).toBeDefined()
  })
}

test('Explorer: ícones Nerd Font coloridos por tipo, com o nome ainda clicável', async ($, on) => {
  stubSession(on, [])
  stubFs(on)
  on('ui.panes', () => ({ value: [] }))
  await start($)
  await $.command.run({ command: 'explorer', args: '' })

  const ui = await $.ui.mount({ ...EXPLORER_PANE, surface: 'terminal' })
  await ui.press({ key: 'dir:src' })
  const tree = JSON.stringify(await ui.drawn())
  // pasta aberta em roxo, README.md (markdown) em verde, app.ts (typescript) em ciano
  expect(tree).toMatch(/#bd93f9[\s\S]{0,120}/)
  expect(tree).toMatch(/#50fa7b[\s\S]{0,120}/)
  expect(tree).toMatch(/#8be9fd[\s\S]{0,120}/)
  expect(await ui.find({ type: 'Button', key: 'file:src/app.ts' })).toBeDefined()
})

test('/explorer icones troca o conjunto, grava e lista as opções', async ($, on) => {
  const saved = new Map<string, unknown>()
  stubSession(on, [], saved)
  stubFs(on)
  on('ui.panes', () => ({ value: [] }))
  await start($)
  await $.command.run({ command: 'explorer', args: '' })

  const ok = await $.command.run({ command: 'explorer', args: 'icones emoji' })
  expect(ok.text).toBe('Ícones do Explorer: emoji')
  expect(saved.get('explorerIcons')).toBe('emoji')
  const ui = await $.ui.mount({ ...EXPLORER_PANE, surface: 'terminal' })
  expect(JSON.stringify(await ui.drawn())).toContain('\u{1F4DD}') // README.md

  await $.command.run({ command: 'explorer', args: 'icones simples' })
  expect(JSON.stringify(await ui.drawn())).toContain('▸')

  const bad = await $.command.run({ command: 'explorer', args: 'icones xpto' })
  expect(bad.text).toMatch(/^Ícones: nerd, simples, emoji/)
})

test('mostra sessão, composição do contexto, reset dos limites e git', async ($, on) => {
  stubSession(on, [], undefined, {
    'session.usage': ($, e) => ({
    value: {
      startedAt: Date.parse('2026-10-14T10:55:00Z'),
      context: {
        tokens: 50_000,
        window: 200_000,
        percent: 25,
        ...(e.breakdown
          ? {
              breakdown: {
                rawMaxTokens: 200_000,
                categories: [
                  { name: 'Messages', tokens: 30_000, kind: 'used' },
                  { name: 'System prompt', tokens: 8_000, kind: 'used' },
                  { name: 'Free space', tokens: 150_000, kind: 'free' },
                ],
                mcpTools: [{ name: 'mcp__claude_ai_Gmail__search', serverName: 'claude.ai Gmail', tokens: 100, isLoaded: false }],
              },
            }
          : {}),
      },
      rateLimits: [{ kind: 'five_hour', percentUsed: 40, resetsAt: '2026-10-14T14:10:00Z' }],
      cost: { usd: 1.234 },
    },
  }),
  })
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /⏱ 1h 05min/ })).toBeDefined()
  // a composição do contexto começa recolhida e abre pela seta
  expect(await ui.find({ type: 'Text', text: /^Mensagens/ })).toBeUndefined()
  await ui.press({ key: 'toggle:context' })
  expect(await ui.find({ type: 'Text', text: /^Mensagens\s+30\.0k\s+15%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Free space/ })).toBeUndefined()
  // o tempo para renovar o limite vai na faixa acima do prompt
  const footer = await $.ui.mount({ ...FOOTER })
  expect(await footer.find({ type: 'Text', text: /^5h 40% ↻ 2h10$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '↑2 ↓0' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'cf8940f feat: explorer' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\+12 −3\s+register\.js$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '? 1 não rastreado' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '○ Gmail' })).toBeUndefined()
  await ui.press({ key: 'toggle:mcp' })
  expect(await ui.find({ type: 'Text', text: '○ Gmail' })).toBeDefined()
})

test('mostra subagentes, os ativos primeiro', async ($, on) => {
  stubSession(on, [], undefined, {
    'agent.list': () => ({
      value: [
        { id: 'a1', description: 'Mapear API', type: 'Explore', status: 'completed' },
        { id: 'a2', description: 'Rodar testes', type: 'general-purpose', status: 'running' },
      ],
    }),
  })
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Subagentes  1 ativo' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '▶ Rodar testes  · general-purpose' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '✓ Mapear API  · Explore' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Próximo passo' })).toBeUndefined()
})

test('atalhos: HANDOFF e LER-HANDOFF preenchem o prompt; EXPLORER e GAME abrem os painéis', async ($, on) => {
  const opens: { id?: string; focus?: boolean }[] = []
  stubSession(on, opens as unknown[])
  on('ui.panes', () => ({ value: [] }))
  stubFs(on)
  const fills: string[] = []
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'prompt:handoff' })
  expect(fills[0]).toMatch(/Atualize o handoff/)
  await ui.press({ key: 'prompt:ler-handoff' })
  expect(fills[1]).toMatch(/Leia o handoff/)

  await ui.press({ key: 'open:explorer' })
  expect(opens.some((o) => o.id === 'explorer')).toBe(true)
  await ui.press({ key: 'open:game' })
  expect(opens.some((o) => o.id === 'game' && o.focus === true)).toBe(true)
})

test('/painel tema troca e grava o tema', async ($, on) => {
  const saved = new Map<string, unknown>()
  stubSession(on, [], saved)
  await start($)

  const r = await $.command.run({ command: 'painel', args: 'tema auto' })
  expect(saved.get('themes')).toEqual({ terminal: 'auto' })
  expect(r.text).toBe('Tema do painel no terminal: auto')
  const bad = await $.command.run({ command: 'painel', args: 'tema xpto' })
  expect(bad.text).toMatch(/^Temas: dracula, auto \(terminal: auto\)/)
})

const env = (variables: Record<string, string>) => ({
  'env.get': ($, e) => ({ value: variables[e.name] }),
})

const APPS = [
  { app: 'Orca', variables: { ORCA_APP_VERSION: '1.4.237' }, dracula: false },
  { app: 'VS Code', variables: { TERM_PROGRAM: 'vscode' }, dracula: true },
  { app: 'terminal', variables: {}, dracula: true },
]
for (const { app, variables, dracula } of APPS) {
  test('cores por ambiente: ' + app + (dracula ? ' usa o Dracula' : ' segue o fundo do terminal'), async ($, on) => {
    stubSession(on, [], undefined, env(variables))
    await start($)

    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(JSON.stringify(await ui.drawn()).includes('#282a36')).toBe(dracula)
  })
}

test('cores por ambiente: a escolha vale só para o ambiente atual', async ($, on) => {
  const saved = new Map<string, unknown>([['themes', { vscode: 'auto' }]])
  stubSession(on, [], saved, env({ ORCA_APP_VERSION: '1.4.237' }))
  await start($)

  // a escolha gravada para outro ambiente não muda o Orca
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(JSON.stringify(await ui.drawn()).includes('#282a36')).toBe(false)

  const r = await $.command.run({ command: 'painel', args: 'tema dracula' })
  expect(r.text).toBe('Tema do painel no Orca: dracula')
  expect(saved.get('themes')).toEqual({ vscode: 'auto', orca: 'dracula' })
  expect(JSON.stringify(await ui.drawn()).includes('#282a36')).toBe(true)
})

test('desenha também no app Desktop', async ($, on) => {
  stubSession(on, [])
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'meu-projeto' })).toBeDefined()
})

// ---------------------------------------------------------------- relógio e calendário



test('relógio: Client com dígitos em blocos e segundos andando', async ($, on) => {
  stubSession(on, [])
  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Client', key: 'relogio' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /[█▀▄]/, in: 'relogio' })).toBeDefined()
    await ui.advance(3000)
    expect(await ui.find({ type: 'Client', key: 'relogio' })).toBeDefined()
    await ui.unmount()
  }
})

test('relógio: no VS Code (sem Client) cai para HH:MM em texto', async ($, on) => {
  stubSession(on, [])
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'vscode' })
  expect(await ui.find({ type: 'Client', key: 'relogio' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^🕒 \d\d:\d\d$/ })).toBeDefined()
})

test('calendário: mês atual com hoje destacado, navegação ‹ › e volta com hoje', async ($, on) => {
  stubSession(on, [])
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: ' outubro 2026 ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'D  S  T  Q  Q  S  S ' })).toBeDefined()
  // 14/10/2026 é quarta; o dia de hoje vem num Text próprio, em negrito e invertido
  expect(await ui.find({ type: 'Text', text: /^14$/ })).toBeDefined()
  expect(await ui.find({ key: 'cal:today' })).toBeUndefined()

  await ui.press({ key: 'cal:next' })
  expect(await ui.find({ type: 'Text', text: ' novembro 2026 ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^14$/ })).toBeUndefined()
  await ui.press({ key: 'cal:prev' })
  await ui.press({ key: 'cal:prev' })
  expect(await ui.find({ type: 'Text', text: ' setembro 2026 ' })).toBeDefined()
  await ui.press({ key: 'cal:today' })
  expect(await ui.find({ type: 'Text', text: ' outubro 2026 ' })).toBeDefined()
})

test('calendário: a seta recolhe a grade e a escolha fica gravada', async ($, on) => {
  const saved = new Map<string, unknown>()
  stubSession(on, [], saved)
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'cal:prev' })).toBeDefined()
  await ui.press({ key: 'toggle:calendar' })
  expect(await ui.find({ key: 'cal:prev' })).toBeUndefined()
  expect((saved.get('sections') as { calendar: boolean }).calendar).toBe(false)
})

// ---------------------------------------------------------------- fliperama

const GAME_PANE = { ...PANE, requestId: 'game', props: { ...PANE.props, title: 'Fliperama' } } as const
const IN_GAME = { in: 'fliperama' }

test('/game abre o fliperama com foco', async ($, on) => {
  const opens: { id: string; focus?: boolean }[] = []
  stubSession(on, opens as unknown[])
  on('ui.panes', () => ({ value: [] }))
  await start($)

  await $.command.run({ command: 'game', args: '' })
  expect(opens.some((o) => o.id === 'game' && o.focus === true)).toBe(true)
})

test('menu escolhe com as setas e o espaço começa o jogo', async ($, on) => {
  stubSession(on, [])
  await start($)

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...GAME_PANE, surface })
    expect(await ui.find({ type: 'Text', text: 'FLIPERAMA', ...IN_GAME })).toBeDefined()
    await ui.key({ key: 'down', in: 'fliperama' })
    await ui.key({ key: ' ', in: 'fliperama' })
    expect(await ui.find({ type: 'Text', text: /^Snake  pontos 0/, ...IN_GAME })).toBeDefined()
    await ui.advance(400)
    await ui.key({ key: 'q', in: 'fliperama' })
    expect(await ui.find({ type: 'Text', text: 'FLIPERAMA', ...IN_GAME })).toBeDefined()
    await ui.unmount()
  }
})

test('Tetris: espaço solta a peça e marca pontos', async ($, on) => {
  stubSession(on, [])
  await start($)

  const ui = await $.ui.mount({ ...GAME_PANE, surface: 'terminal' })
  await ui.key({ key: '1', in: 'fliperama' })
  await ui.key({ key: 'up', in: 'fliperama' })
  await ui.key({ key: 'left', in: 'fliperama' })
  await ui.key({ key: ' ', in: 'fliperama' })
  expect(await ui.find({ type: 'Text', text: /^Tetris  pontos [1-9]/, ...IN_GAME })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Próxima/, ...IN_GAME })).toBeDefined()
})

test('Pac-Man desenha o labirinto e o p pausa', async ($, on) => {
  stubSession(on, [])
  await start($)

  const ui = await $.ui.mount({ ...GAME_PANE, surface: 'terminal' })
  await ui.key({ key: '3', in: 'fliperama' })
  expect(await ui.find({ type: 'Text', text: /PRONTO!/, ...IN_GAME })).toBeDefined()
  await ui.advance(2000)
  await ui.key({ key: 'p', in: 'fliperama' })
  expect(await ui.find({ type: 'Text', text: /PAUSADO/, ...IN_GAME })).toBeDefined()
})

test('recorde que o jogo manda é gravado e aparece no menu', async ($, on) => {
  const saved = new Map<string, unknown>([['gameHighs', { tetris: 100 }]])
  stubSession(on, [], saved)
  await start($)

  const ui = await $.ui.mount({ ...GAME_PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Tetris\s+recorde 100/, ...IN_GAME })).toBeDefined()
  await ui.post({ type: 'score', game: 'snake', score: 70 }, IN_GAME)
  expect(saved.get('gameHighs')).toEqual({ tetris: 100, snake: 70, pacman: 0, sokoban: 0 })
  expect(await ui.find({ type: 'Text', text: /Snake\s+recorde 70/, ...IN_GAME })).toBeDefined()

  // Pontuação menor ou dado inválido não mexem no recorde.
  await ui.post({ type: 'score', game: 'snake', score: 10 }, IN_GAME)
  await ui.post({ type: 'score', game: 'xadrez', score: 999 }, IN_GAME)
  expect(saved.get('gameHighs')).toEqual({ tetris: 100, snake: 70, pacman: 0, sokoban: 0 })
})

test('Sokoban: empurra a caixa, passa de fase, reinicia e grava as fases feitas ao sair', async ($, on) => {
  const saved = new Map<string, unknown>()
  stubSession(on, [], saved)
  await start($)

  const ui = await $.ui.mount({ ...GAME_PANE, surface: 'terminal' })
  await ui.key({ key: '4', in: 'fliperama' })
  expect(await ui.find({ type: 'Text', text: /^Sokoban  pontos 0/, ...IN_GAME })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /fase 1\/10/, ...IN_GAME })).toBeDefined()

  // Fase 1: um empurrão para a esquerda põe a caixa no destino.
  await ui.key({ key: 'left', in: 'fliperama' })
  expect(await ui.find({ type: 'Text', text: /FASE CONCLUÍDA/, ...IN_GAME })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Sokoban  pontos 100/, ...IN_GAME })).toBeDefined()
  await ui.key({ key: ' ', in: 'fliperama' })
  expect(await ui.find({ type: 'Text', text: /fase 2\/10/, ...IN_GAME })).toBeDefined()

  // Fase 2: o jogador anda, a parede segura e o r volta ao começo da fase.
  await ui.key({ key: 'up', in: 'fliperama' })
  await ui.key({ key: 'up', in: 'fliperama' })
  await ui.key({ key: 'r', in: 'fliperama' })
  expect(await ui.find({ type: 'Text', text: /fase 2\/10/, ...IN_GAME })).toBeDefined()

  // Sair com fases feitas manda a pontuação para o recorde.
  await ui.key({ key: 'q', in: 'fliperama' })
  expect(saved.get('gameHighs')).toEqual({ tetris: 0, snake: 0, pacman: 0, sokoban: 100 })
  expect(await ui.find({ type: 'Text', text: /Sokoban\s+recorde 100/, ...IN_GAME })).toBeDefined()
})

test('no VS Code, sem Client, o fliperama explica em vez de quebrar', async ($, on) => {
  stubSession(on, [])
  await start($)
  const ui = await $.ui.mount({ ...GAME_PANE, surface: 'vscode' })
  expect(await ui.find({ type: 'Text', text: /só roda no Claude Code do terminal/ })).toBeDefined()
})

// O que o Claude Code passa ao ui.render da faixa acima do prompt
const FOOTER = {
  plugin: 'right-panel',
  component: 'AbovePrompt',
  surface: 'terminal',
  viewport: { columns: 120, rows: 40 },
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 115,
    scroll: { offset: 0, bodyRows: 9 },
    view: {},
  },
} as const

test('rodapé: faixa com modelo, contexto e limites acima do prompt', async ($, on) => {
  stubSession(on, [])
  await start($)
  const ui = await $.ui.mount({ ...FOOTER })
  expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ctx .* 25%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^5h 40%/ })).toBeDefined()
})

test('rodapé: estreito tira a barra do contexto e o tempo para renovar', async ($, on) => {
  stubSession(on, [])
  await start($)
  const ui = await $.ui.mount({ ...FOOTER, props: { ...FOOTER.props, bodyColumns: 30 } })
  expect(await ui.find({ type: 'Text', text: 'ctx 25%' })).toBeDefined()
})

test('rodapé: some quando há pesquisa na faixa e /rodape off desliga e grava', async ($, on) => {
  const saved = new Map<string, unknown>()
  on('ui.render', ($, e) => $.ui.resolve(e).Text({ children: 'motor' }))
  stubSession(on, [], saved)
  await start($)
  const survey = await $.ui.mount({ ...FOOTER, props: { ...FOOTER.props, hasSurvey: true } })
  expect(await survey.find({ type: 'Text', text: 'motor' })).toBeDefined()
  expect(await survey.find({ type: 'Text', text: 'Opus 5.5' })).toBeUndefined()

  const result = await $.command.run({ command: 'rodape', args: 'off' })
  expect(result.text).toBe('Faixa do rodapé desligada')
  expect(saved.get('footerOn')).toBe(false)
  const ui = await $.ui.mount({ ...FOOTER })
  expect(await ui.find({ type: 'Text', text: 'motor' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Opus 5.5' })).toBeUndefined()
})

test('rodapé: o effort do turn.step aparece na faixa; o de subagente não conta', async ($, on) => {
  stubSession(on, [])
  on('turn.step', async function* ($, e) {
    return { turnId: e.turnId, index: e.index, answer: "", toolUses: [], stopReason: null, usage: null }
  })
  await start($)
  const step = { turnId: 't1', index: 0, model: 'opus', messageCount: 1 }
  for await (const chunk of $.turn.step({ ...step, agentId: 'sub-1', effort: 'low' })) void chunk
  expect(await (await $.ui.mount({ ...FOOTER })).find({ type: 'Text', text: /^effort/ })).toBeUndefined()
  for await (const chunk of $.turn.step({ ...step, effort: 'high' })) void chunk
  expect(await (await $.ui.mount({ ...FOOTER })).find({ type: 'Text', text: 'effort high' })).toBeDefined()
})

const FX = (bid: string) => ({ value: { status: 200, ok: true, headers: {}, text: JSON.stringify({ USDBRL: { bid } }) } })
const NOW = Date.parse('2026-10-14T12:00:00Z')

test('rodapé: custo em dólar e em reais e a cotação, buscada na rede e guardada', async ($, on) => {
  const saved = new Map<string, unknown>()
  const urls: string[] = []
  on('http.fetch', ($, e) => (urls.push(e.url), FX('5.3537')))
  stubSession(on, [], saved)
  await start($)
  await new Promise((resolve) => setTimeout(resolve, 30))

  expect(urls).toEqual(['https://economia.awesomeapi.com.br/json/last/USD-BRL'])
  expect(saved.get('usdBrl')).toEqual({ rate: 5.3537, at: NOW })
  const ui = await $.ui.mount({ ...FOOTER })
  expect(await ui.find({ type: 'Text', text: 'US$ 1.23 ≈ R$ 6.61' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'US$ 1 = R$ 5.35' })).toBeDefined()
})

test('rodapé: cotação guardada e recente não vai à rede; velha é renovada', async ($, on) => {
  const fresh = new Map<string, unknown>([['usdBrl', { rate: 5, at: NOW - 60_000 }]])
  let calls = 0
  on('http.fetch', () => (calls += 1, FX('6')))
  stubSession(on, [], fresh)
  await start($)
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(calls).toBe(0)
  expect(await (await $.ui.mount({ ...FOOTER })).find({ type: 'Text', text: 'US$ 1.23 ≈ R$ 6.17' })).toBeDefined()
})

test('rodapé: sem rede mostra o custo em dólar, e com cotação velha segue com ela', async ($, on) => {
  const old = new Map<string, unknown>([['usdBrl', { rate: 5, at: NOW - 3 * 3_600_000 }]])
  on('http.fetch', () => ({ value: { status: 500, ok: false, headers: {}, text: '' } }))
  stubSession(on, [], old)
  await start($)
  await new Promise((resolve) => setTimeout(resolve, 30))
  expect(await (await $.ui.mount({ ...FOOTER })).find({ type: 'Text', text: 'US$ 1.23 ≈ R$ 6.17' })).toBeDefined()
})

test('rodapé: sem cotação nenhuma mostra só o dólar e o painel não repete o custo', async ($, on) => {
  stubSession(on, [])
  await start($)
  const footer = await $.ui.mount({ ...FOOTER })
  expect(await footer.find({ type: 'Text', text: 'US$ 1.23' })).toBeDefined()
  expect(await footer.find({ type: 'Text', text: /^US\$ 1 =/ })).toBeUndefined()
  const panel = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await panel.find({ type: 'Text', text: /US\$ 1\.23/ })).toBeUndefined()
})

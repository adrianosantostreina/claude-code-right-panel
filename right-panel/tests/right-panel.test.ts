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
  expect(await ui.find({ type: 'Text', text: /25%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '50.0k / 200.0k tokens' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Custo: US$ 1.23' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^5h/ })).toBeDefined()
})

test('não abre sozinho quando o usuário fechou antes', async ($, on) => {
  const opens: unknown[] = []
  stubSession(on, opens, new Map([['autoOpen', false]]))
  await start($)
  expect(opens.length).toBe(0)
})

test('lista tarefas, arquivos alterados e MCPs usados', async ($, on) => {
  stubSession(on, [])
  await start($)

  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Escrever testes', status: 'completed', activeForm: 'Escrevendo testes' },
      { content: 'Montar painel', status: 'in_progress', activeForm: 'Montando painel' },
      { content: 'Publicar', status: 'pending', activeForm: 'Publicando' },
    ],
  })
  await $.tool.call({ tool: 'Edit', file_path: 'D:\\proj\\src\\app.ts', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Edit', file_path: 'D:\\proj\\src\\app.ts', old_string: 'b', new_string: 'c' })
  await $.tool.call({ tool: 'mcp__claude_ai_Gmail__search_threads', query: 'x' })

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: 'Tarefas  1/3' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '▶ Montando painel' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '• app.ts  ×2' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '● Gmail  1' })).toBeDefined()
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
  expect(await ui.find({ type: 'Text', text: /^Mensagens\s+30\.0k\s+15%$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^Free space/ })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: /^5h .*↻ 2h10$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '↑2 ↓0' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'cf8940f feat: explorer' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^\+12 −3\s+register\.js$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '? 1 não rastreado' })).toBeDefined()
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

test('atalho preenche o prompt e comando rápido roda o /compact', async ($, on) => {
  stubSession(on, [])
  const fills: string[] = []
  const runs: string[] = []
  on('prompt.fill', ($, e) => {
    fills.push(e.text)
    return { isFilled: true, text: e.text, cursor: e.text.length }
  })
  on('command.run', { command: 'compact' }, ($, e) => {
    runs.push(e.command)
    return {}
  })
  await start($)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'prompt:commit' })
  expect(fills[0]).toMatch(/commit/)
  await ui.press({ key: 'cmd:compact' })
  expect(runs).toEqual(['compact'])
})

test('/painel tema troca e grava o tema', async ($, on) => {
  const saved = new Map<string, unknown>()
  stubSession(on, [], saved)
  await start($)

  const r = await $.command.run({ command: 'painel', args: 'tema auto' })
  expect(saved.get('theme')).toBe('auto')
  expect(r.text).toBe('Tema do painel: auto')
  const bad = await $.command.run({ command: 'painel', args: 'tema xpto' })
  expect(bad.text).toMatch(/^Temas: dracula, auto/)
})

test('desenha também no app Desktop', async ($, on) => {
  stubSession(on, [])
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'meu-projeto' })).toBeDefined()
})

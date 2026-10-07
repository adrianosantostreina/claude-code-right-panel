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
function stubSession(on, opens: unknown[], saved = new Map<string, unknown>()) {
  on('session.start', () => ({ cwd: '/work/meu-projeto' }))
  on('session.messages', () => ({ value: [] }))
  on('session.cwd', () => ({ value: '/work/meu-projeto' }))
  on('session.model', () => ({ value: 'Opus 5.5' }))
  on('session.usage', () => ({
    value: {
      context: { tokens: 50_000, window: 200_000, percent: 25 },
      rateLimits: [{ kind: 'five_hour', percentUsed: 40 }],
      cost: { usd: 1.234 },
    },
  }))
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'main\n', stderr: '' } }))
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

test('desenha também no app Desktop', async ($, on) => {
  stubSession(on, [])
  await start($)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: 'meu-projeto' })).toBeDefined()
})

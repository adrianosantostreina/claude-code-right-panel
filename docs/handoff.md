# Handoff — Right Panel

## Onde paramos (2026-10-19)

Duas versões novas nesta sessão:

- **v0.4.0 — fliperama (`/game`)**: Tetris, Snake e Pac-Man. Commitada (`3bcab73`), enviada ao GitHub e publicada como Release `v0.4.0` (primeira tag do repo).
- **v0.5.0 — Explorer com ícones coloridos (`/explorer`)**: escrita, validada, 20 testes passando e **instalada no escopo user, mas ainda NÃO commitada nem publicada**. Arquivos pendentes de commit: `right-panel/hooks/register.js`, `right-panel/tests/right-panel.test.ts` e `right-panel/.claude-plugin/plugin.json` (só o handoff foi commitado).

O usuário rodou `/painel`, `/game` e `/explorer` durante a sessão, mas **não deu retorno de como ficou na tela**. Nada do que depende de ver o desenho (glifos, cores, jogo) foi confirmado ao vivo.

## Próximo passo concreto

1. Reiniciar o Claude Code (a 0.5.0 já está instalada) e olhar `/explorer`: ícones certos, cores, hover roxo. Depois `/game`: clicar no painel e jogar os três.
2. Se algo precisar de ajuste, sai como 0.5.1 (ícone errado = trocar o código em `ICON_SETS.nerd`).
3. Quando o usuário aprovar: commitar a 0.5.0 e rodar `/asa:update-github`. **Perguntar a versão do Release** (o comando exige; na 0.4.0 o usuário aceitou a proposta `v0.4.0`). Já foi perguntado ao usuário se quer commit + push + Release `v0.5.0`; **sem resposta ainda**.
4. Itens menores em "A validar ao vivo".

## Decisões desta sessão (o que não está óbvio no código)

- **Fliperama**: pedido como brincadeira — `/game` abre um painel para escolher Tetris, Snake ou Pac-Man, controle por setas e espaço. Implementado como `Client` (módulo de superfície `hooks/games.js`), porque é o único elemento que recebe teclado e tem relógio próprio. O usuário foi avisado da limitação de teclado (abaixo) e não objetou.
- **Explorer**: o usuário perguntou se dava para ser colorido ou ter ícones e respondeu **"uso fonte Nerd sim"** e que **as alternativas também pareciam interessantes**. Por isso saíram três conjuntos de ícones: `nerd` (padrão), `simples` e `emoji`, trocáveis por comando. Proposta aceita: só o **nome** é clicável, o ícone colorido é só enfeite ao lado.
- **Instalar**: o usuário pediu "Instale o plugin aqui vc mesmo". Ao terminar uma versão, instalar sem perguntar (`claude plugin marketplace update asa-right-panel` e `claude plugin update right-panel@asa-right-panel`). `update` só enxerga a versão nova se o `plugin.json` foi bumpado.
- **Commit, push e Release**: só quando o usuário pede (ele usou `/asa:update-github`). A 0.4.0 foi commitada depois de "ok, comita e segue".
- Cada versão nova mexe em `plugin.json` (version e description), no handoff e nos testes.

## Explorer com ícones (v0.5.0)

- Cada linha: `Box` com `key: 'row:<caminho>'` contendo um `Text` colorido (indentação + ícone) e o `Button` do nome (chaves `dir:`/`file:` iguais às antigas, os testes dependem delas).
- Conjuntos em `ICON_SETS`: `nerd` (Font Awesome `f0xx/f1xx`, Devicons `e7xx`, Seti `e6xx`), `simples` (`▸ ▾ ●`) e `emoji`. Troca com `/explorer icones nerd|simples|emoji`, gravada em `$.store` (`explorerIcons`). Sem argumento, `/explorer` abre e fecha como antes.
- Cor por tipo em `KIND_COLORS` (chaves da paleta; o Dracula ganhou `orange`): pasta roxo, js amarelo, ts ciano, json/config laranja, md verde, Delphi (`.pas .dpr .dfm ...`) rosa, imagem rosa, git/npm/pdf/html vermelho. Pastas de build e dependência (`MUTED_DIRS`: `node_modules`, `.claude-plugin`, `dist`, `__history`, `Win32`...) ficam apagadas.
- Não existe ícone de Delphi na Nerd Font: `.pas/.dfm` usam o de código (`f121`) em rosa.
- Base do Explorer (v0.2.0): painel id `explorer`, só abre por `/explorer`; lê pastas com `$.fs.list` só quando abertas e relê depois de Edit/Write/MultiEdit/NotebookEdit/Bash; clicar em arquivo copia o caminho relativo (`$.ui.copy`); hotkeys `r` (atualizar) e `c` (recolher); limite de 500 linhas; oculta só `.git`. Sem argumento, `$.fs.list()` chega ao hook como o caminho absoluto do diretório de trabalho.

## Fliperama (v0.4.0)

- `/game` abre/fecha o pane `game` ("Fliperama", `focus: true`, `columns: 44`, `rows: 28`). Menu: ↑↓ escolhe, espaço/Enter joga, `1 2 3` atalhos, clique no nome também começa.
- Jogos em `right-panel/hooks/games.js`, desenhados por `Client({ key: 'fliperama', module: './games.js' })`. Roda no thread de desenho **sem `$`**, com `surface.every` (tick de 40 ms), `surface.onKey` e `surface.onPointer`. O validador reconhece o módulo mesmo com `Client(...)` em chamada, sem JSX.
- **O `Client` só recebe teclas depois de um clique na área dele** (não existe `$.ui.focus` para Client) e o Esc devolve o teclado ao prompt. O menu avisa. Para o jogo não seguir sozinho depois do Esc, o hook passa `focused` (o `isFocused` do Pane) e o Client pausa na transição true→false.
- Teclas: Tetris ←→ move, ↑ gira (com empurrão na parede), ↓ desce, espaço solta, sombra, saco de 7. Snake: setas (fila de 3), espaço pausa. Pac-Man: setas, 4 fantasmas com alvos diferentes, energizante, túnel, 3 vidas, níveis. Em todos: `p` pausa, `q` volta ao menu, WASD também.
- Recordes: no fim da partida o Client faz `surface.post({ type: 'score', game, score })`; o hook `ui.message` valida, grava em `$.store` (`gameHighs`) e responde `{ props }`.
- Sem `Client` (surface `vscode` ou `mobile`) ou com `ui.fault`, o pane mostra uma mensagem em vez do jogo.
- Desenho: célula de 2 colunas (`██`, `▓▓`, `▟▙` fantasma, `▐▌` comida). Pac-Man é `██` amarelo e parede `██` azul-acinzentado: só a cor diferencia.

## Painel principal (v0.3.x)

Seções, nesta ordem: Sessão (duração, prompts, custo) · Contexto + composição (`session.usage({ breakdown: 'summary' })`) · Limites com tempo até renovar · Tarefas · Subagentes (`$.agent.list`) · Arquivos alterados · Git · MCP (conectados + contagem de uso) · Atalhos.

- **Tema**: `dracula` (padrão, fundo `#282a36` com `minHeight = bodyRows`) ou `auto`. Troca com `/painel tema dracula|auto`, gravado em `$.store` (`theme`). Os painéis Explorer e Fliperama usam a mesma paleta.
- **Cores e fonte**: o mod controla `color` e `backgroundColor` em `Box`/`Text`. A **fonte não é controlável**: vem do terminal (`terminal.integrated.fontFamily`). A borda e o título do pane são da moldura do Claude Code, não do mod.
- `$.ui.view({ agentId })` (abrir transcript de subagente) aparece no reference.md do skill, mas **não existe nos tipos desta build**. Subagentes é só texto, sem clique.
- **Atalhos**: `commit`, `handoff`, `testes`, `revisar` preenchem o prompt (`$.prompt.fill`, mode `replace`, **sem enviar**); `/compact` e `/clear` rodam com `$.command.run`.
- **Ticker** de 15 s (`$.clock.every`) atualiza duração, reset dos limites e subagentes.
- **Seção "Próximo passo" foi removida a pedido do usuário** (lia este handoff e mostrava no painel; poluía). **Não reintroduzir.**
- **MCP**: conectados vêm de `breakdown.mcpTools` + `$.tool.list()`; `serverKey` normaliza "claude.ai Gmail" e `claude_ai_Gmail`.

## Ideias oferecidas e não escolhidas (2026-10-14)

O usuário deixou de fora: **PR/CI via `gh`**, **último build Delphi** (`build_log.txt`), **resumo da sessão em uma linha com o Haiku** (chamada paga a cada resumo) e **atividade recente das ferramentas**. Só voltar a elas se o usuário pedir.

## A validar ao vivo

- **Surface do usuário**: o jogo só roda na surface `terminal`. Se ao rodar `/game` aparecer "O fliperama só roda no Claude Code do terminal", o usuário está na extensão do VS Code (surface `vscode`, sem `Client`), não no terminal integrado. Nesse caso o fliperama não tem como funcionar e o caminho é rodar o Claude Code no terminal.
- Fliperama: se `isFocused` muda mesmo ao apertar Esc (pausa automática), se a velocidade dos três jogos está boa, se Pac-Man e parede se distinguem só pela cor.
- Explorer: glifos Nerd Font certos (nenhum quadrado), cores, hover, `/explorer icones emoji|simples`.
- Painel principal: fundo Dracula preenchendo tudo, `flexWrap`/`columnGap` nas linhas de botões, `variant: 'secondary'`, `$.command.run` de `clear`/`compact` por botão, `$.agent.list` com subagentes reais.
- `claude plugin validate` passa mas avisa **"gating hook without .catch"** em `tool.call`, `ui.close{id=right-panel}` e `classic.SessionStart`. Avaliar se vale tratar.
- Desde a v0.1.0: formato real de `TaskCreate`/`TaskUpdate` (id lido do texto `#N`).

## Armadilhas

- **`hover` num Button exige uma `Box` com `key` em volta**; sem isso o engine recusa a árvore inteira e desenha o painel dele (`ui.render (Pane) refused: Button "..." hover has no Box with a key around it`). Foi pego pelos testes da 0.5.0.
- **O texto de um Button não aceita cor** (só `dimColor` e `hover`). Para colorir, use um `Text` ao lado.
- `Box` não é clicável (sem `onPress`); só `Button`. Um Button aceita no máximo uma string como label ou filho.
- Testes de `/explorer` e `/painel` chamam `ui.panes`: o teste precisa de `on('ui.panes', ...)`, senão o hook é pulado ("no implementation for ui.panes").
- Nos testes (`claude-code/testing`), registrar `on(evento)` duas vezes derruba o módulo ("registered twice"): para trocar um stub padrão, passe-o em `overrides` do `stubSession`.
- Teste de `Client`: `ui.key({ key, in: 'fliperama' })`, `ui.advance(ms)` e `ui.post(data, { in: 'fliperama' })`; achar texto dentro do Client exige `in: 'fliperama'` no `find`.
- Não instalar e desenvolver ao mesmo tempo: a cópia instalada fica em cache por versão. Desenvolver sempre com `--plugin-dir`, com a cópia instalada desabilitada.
- Nome do plugin não pode começar com `claude-`.
- `focus`, `closeOnEscape` em `$.ui.open` aceitam só `true`; passar `false` dá erro.

## Regras do código do mod

Estão no `CLAUDE.md` do projeto (chamadas `$.ns.metodo` por extenso, `on('evento')` literal, funções com `$` no topo do arquivo). O módulo `games.js` fica fora disso: não tem `$`.

## Como rodar e validar

```bash
claude plugin validate ./right-panel
cd right-panel && claude plugin test
claude plugin disable right-panel@asa-right-panel
claude --plugin-dir "./right-panel"
```

Ao terminar: `claude plugin marketplace update asa-right-panel`, `claude plugin update right-panel@asa-right-panel` e `claude plugin enable right-panel@asa-right-panel`.

## Git e instalação

- Branch `main`, em dia com `origin/main` em `3bcab73` (0 à frente, 0 atrás) no início deste handoff. Tag/Release: `v0.4.0`. Repo privado: https://github.com/adrianosantostreina/claude-code-right-panel.
- **Mudanças não commitadas**: os 3 arquivos da v0.5.0 listados no topo. O commit deste handoff fica local; **não dar push sem o usuário pedir**.
- Plugin **instalado no escopo user** pelo marketplace local `asa-right-panel` (aponta para esta pasta), habilitado, versão **0.5.0** (instalada antes do commit).

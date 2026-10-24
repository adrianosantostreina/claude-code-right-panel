# Handoff — Right Panel

## Onde paramos (2026-10-24)

Versões:

- **v0.4.0 — fliperama (`/game`)**: Tetris, Snake e Pac-Man. Publicada como Release `v0.4.0` (primeira tag do repo).
- **v0.5.0 — Explorer com ícones coloridos (`/explorer`)**: absorvida pela 0.6.x, nunca publicada sozinha.
- **v0.6.0 — Sokoban no fliperama**: 4º jogo, 10 fases, o básico (sem contador de movimentos e sem desfazer, a pedido).
- **v0.6.1 — controles do fliperama por WASD**: commitada, enviada ao GitHub e instalada no escopo user. O usuário testou ao vivo e confirmou: "funcionou tudo". Publicada como Release `v0.6.1` (cobre Explorer + Sokoban + WASD desde a `v0.4.0`).
- **v0.7.0 — layout novo do painel principal + cores por ambiente**: feita em `feature/painel-principal`, instalada no escopo user e **versão atual do plugin**. Entra na `main` e vira Release junto com este ajuste (a Release cobre tudo desde a `v0.6.1`). O usuário confirmou que o `auto` fica bom no Orca; o layout novo e a detecção automática ainda não foram vistos ao vivo (ele só havia testado o `/painel tema` da versão antiga).
- **v0.8.0 — relógio digital + calendário no fim do painel**: commitada (`25ee6ef`) e enviada à `main`, instalada e **versão atual**. O usuário viu ao vivo no Orca e aprovou ("ficou ótimo"). **Release `v0.8.0` ainda NÃO criada**: o usuário pediu "commitar tudo e gerar um release"; propus a tag `v0.8.0` sobre `origin/main` e fiquei esperando o "ok" do `/asa:github-release` (a skill não deixa inferir a versão). Veja a seção "Relógio e calendário (v0.8.0)".
- **Antiga proposta de v0.8.0 (mais 5 jogos + Sokoban maior): DESCARTADA** (2026-10-24). Os jogos novos deram erro e o usuário mandou descartar. O código ficou guardado só no `stash@{0}` ("mais-jogos: trabalho descartado"); **não está em nenhuma branch**. Veja a seção "v0.8.0 descartada".

## Próximo passo concreto

0. Criar a tag/Release `v0.8.0` (`/asa:github-release v0.8.0`), se o usuário ainda quiser; a última tag é `v0.7.0`.
1. Olhar o painel principal no **VS Code** (o Orca já foi visto ao vivo na 0.8.0): ordem das seções, cores sem `/painel tema` e o relógio, que na extensão do VS Code cai para `🕒 HH:MM` em texto.
2. Se o usuário quiser os jogos novos de novo: não reaplicar o stash direto. Partir da `main`, trazer **um jogo por vez** (cada um commitado e testado ao vivo antes do próximo) e descobrir qual deu erro. Não oferecer Pong, Frogger nem Flappy sem ele puxar.
3. Extras já pensados e fora do básico do Sokoban: contador de movimentos, desfazer (`u`/`z`).
4. Itens menores em "A validar ao vivo".

## O bug "o /game fecha o painel e a sessão" (resolvido na 0.6.1)

- **Sintoma**: ao navegar no menu do fliperama (mouse ou setas), a sessão do Claude Code inteira "caía" e voltava sozinha só com o painel Sessão.
- **Causa** (achada no log de `claude --debug-file`): a seta **←** com o prompt vazio é um atalho nativo do Claude Code que sai da sessão para a lista de sessões em segundo plano (`[PERF:bg-leftarrow-start]` → `[REPL:unmount]` → `bg-claim`). Não era o mod fechando nada. O `Client` só recebe teclas **depois de um clique nele**; sem o clique, a ← vai para o Claude Code. A doc diz que as setas são do painel e que jogos andam com `w a s d`.
- **Correção**: menu e ajuda de todos os jogos mostram `w a s d`; as setas ainda funcionam com o jogo focado; o `Client` ocupa o painel todo (`width: '100%'`, `height: bodyRows`) para qualquer clique focar; o menu avisa em vermelho que sem o clique a ← sai da sessão.
- **Como investigar o próximo bug parecido**: `claude plugin disable right-panel@asa-right-panel` e `claude --debug-file ./mod-debug.log --plugin-dir ./right-panel`, reproduzir e ler o fim do log. Não commitar o `mod-debug.log`.

## Decisões desta sessão (o que não está óbvio no código)

- **Fliperama**: pedido como brincadeira — `/game` abre um painel para escolher Tetris, Snake ou Pac-Man, controle por setas e espaço. Implementado como `Client` (módulo de superfície `hooks/games.js`), porque é o único elemento que recebe teclado e tem relógio próprio. O usuário foi avisado da limitação de teclado (abaixo) e não objetou.
- **Explorer**: o usuário perguntou se dava para ser colorido ou ter ícones e respondeu **"uso fonte Nerd sim"** e que **as alternativas também pareciam interessantes**. Por isso saíram três conjuntos de ícones: `nerd` (padrão), `simples` e `emoji`, trocáveis por comando. Proposta aceita: só o **nome** é clicável, o ícone colorido é só enfeite ao lado.
- **Instalar**: o usuário pediu "Instale o plugin aqui vc mesmo". Ao terminar uma versão, instalar sem perguntar (`claude plugin marketplace update asa-right-panel` e `claude plugin update right-panel@asa-right-panel`). `update` só enxerga a versão nova se o `plugin.json` foi bumpado.
- **Commit, push e Release**: só quando o usuário pede (ele usou `/asa:update-github`). A 0.4.0 foi commitada depois de "ok, comita e segue".
- Cada versão nova mexe em `plugin.json` (version e description), no handoff e nos testes.
- **Escopo da 0.8.0 (2026-10-24), descartada**: o usuário perguntou "que outros joguinhos? Space Invaders?" e que o campo do Sokoban "ficou pequeno". Ofereci Invaders, Breakout, 2048, Termo e Campo Minado mais o zoom/fases maiores do Sokoban e ele respondeu **"Faz, aceito todas as sugestões"**: por isso saiu tudo de uma vez. Depois os jogos novos deram erro e ele mandou descartar. Lição: entregar tudo de uma vez sem ver ao vivo foi o que impediu isolar o erro. Ele não pediu Pong, Frogger nem Flappy; não oferecer de novo sem ele puxar.

## Explorer com ícones (v0.5.0)

- Cada linha: `Box` com `key: 'row:<caminho>'` contendo um `Text` colorido (indentação + ícone) e o `Button` do nome (chaves `dir:`/`file:` iguais às antigas, os testes dependem delas).
- Conjuntos em `ICON_SETS`: `nerd` (Font Awesome `f0xx/f1xx`, Devicons `e7xx`, Seti `e6xx`), `simples` (`▸ ▾ ●`) e `emoji`. Troca com `/explorer icones nerd|simples|emoji`, gravada em `$.store` (`explorerIcons`). Sem argumento, `/explorer` abre e fecha como antes.
- Cor por tipo em `KIND_COLORS` (chaves da paleta; o Dracula ganhou `orange`): pasta roxo, js amarelo, ts ciano, json/config laranja, md verde, Delphi (`.pas .dpr .dfm ...`) rosa, imagem rosa, git/npm/pdf/html vermelho. Pastas de build e dependência (`MUTED_DIRS`: `node_modules`, `.claude-plugin`, `dist`, `__history`, `Win32`...) ficam apagadas.
- Não existe ícone de Delphi na Nerd Font: `.pas/.dfm` usam o de código (`f121`) em rosa.
- Base do Explorer (v0.2.0): painel id `explorer`, só abre por `/explorer`; lê pastas com `$.fs.list` só quando abertas e relê depois de Edit/Write/MultiEdit/NotebookEdit/Bash; clicar em arquivo copia o caminho relativo (`$.ui.copy`); hotkeys `r` (atualizar) e `c` (recolher); limite de 500 linhas; oculta só `.git`. Sem argumento, `$.fs.list()` chega ao hook como o caminho absoluto do diretório de trabalho.

## Relógio e calendário (v0.8.0)

- **Ordem do painel**: projeto · branch · modelo · Atalhos · Sessão · Contexto · Limites · Tarefas · Subagentes · Git · MCP · **relógio** · **Calendário**. Relógio e calendário ficam no **fim** (a pedido: "pode ser na parte inferior").
- **Relógio** = `Client({ key: 'relogio', module: './clock.js', height: 3 })`, módulo `hooks/clock.js` (sem `$`, usa `Date` local e `surface.every(1000)`). Dígitos 3x5 em **meio bloco** (`▀▄█`), 5 linhas de pixel viram 3 de texto: a versão de 5 linhas "esticava na vertical". Segundos rosa, `HH:MM` roxo, dois-pontos piscam. Com menos de 27 colunas some os segundos. Sem `Client` (surface `vscode`) ou com `ui.fault` do painel: `🕒 HH:MM` em texto, pelo ticker de 15 s. A data por extenso foi **removida** para ganhar uma linha.
- **Calendário** no `register.js` (`drawCalendar`, `monthGrid`): semana começa no domingo, hoje em negrito+invertido rosa, domingos laranja. Título `Calendário ▾ ‹ mês ano › [hoje]` numa linha só; `‹ ›` e `hoje` mexem em `calendarOffset` (não persiste); a seta grava `sections.calendar` (padrão aberto).
- **Recusado pelo usuário**: tirar todas as linhas em branco entre as seções ("muito apertado agora"); ele quer os espaços de volta e prefere que se economize juntando linhas de conteúdo. Pediu também dígitos "mais baixos" (meio bloco) e depois relógio/calendário embaixo, não no topo.
- **Altura**: não dá para fazer linha em branco mais baixa (a grade do terminal é de linhas inteiras). Em vez disso, com os espaços entre seções de volta, juntei linhas: Sessão+custo, tokens+`▸ composição`, não rastreados na linha do git, título do calendário com o mês. Se rolar a barra, os Atalhos podem virar uma linha só.
- Testes: `relógio`, `relógio sem Client`, `calendário` (navegação) e `calendário recolhe`; o de ordem agora checa relógio/calendário depois do Git.

## v0.8.0 antiga descartada (jogos novos e Sokoban maior)

- **O que era**: Space Invaders, Breakout, 2048, Termo e Campo Minado (ids `invaders`, `breakout`, `g2048`, `termo`, `mines`; menu `1-9`) e Sokoban com casas de 4x2 e fases 11-15 (15 no total). Mexia em `hooks/games.js`, `register.js`, `plugin.json` e nos testes (+1138 linhas).
- **Por que saiu**: os jogos novos deram erro; o usuário mandou descartar. Não registrei qual erro nem em qual jogo, então não se sabe se o problema era um jogo só ou o motor compartilhado (células com fundo, `RULES.pointer`, `keyName` cru).
- **Onde está**: só em `git stash show -p stash@{0}`. Pode servir de referência, mas a `main` (0.7.0) é a base. Se for apagar o stash (`git stash drop`), perde o código de vez.
- **Se retomar**: um jogo por vez, testado ao vivo antes do próximo; reportar o erro exato (`claude --debug-file ./mod-debug.log --plugin-dir ./right-panel`).

## Fliperama (v0.4.0)

- `/game` abre/fecha o pane `game` ("Fliperama", `focus: true`, `columns: 44`, `rows: 28`). Menu: `w`/`s` (ou ↑↓) escolhem, espaço/Enter joga, `1-4` atalhos, clique no nome também começa.
- Jogos em `right-panel/hooks/games.js`, desenhados por `Client({ key: 'fliperama', module: './games.js' })`. Roda no thread de desenho **sem `$`**, com `surface.every` (tick de 40 ms), `surface.onKey` e `surface.onPointer`. O validador reconhece o módulo mesmo com `Client(...)` em chamada, sem JSX.
- **O `Client` só recebe teclas depois de um clique na área dele (por isso ele ocupa o painel todo)** (não existe `$.ui.focus` para Client) e o Esc devolve o teclado ao prompt. O menu avisa. Para o jogo não seguir sozinho depois do Esc, o hook passa `focused` (o `isFocused` do Pane) e o Client pausa na transição true→false.
- Teclas (WASD é o padrão mostrado; as setas equivalem): Tetris `a`/`d` move, `w` gira (com empurrão na parede), `s` desce, espaço solta, sombra, saco de 7. Snake: setas (fila de 3), espaço pausa. Pac-Man: setas, 4 fantasmas com alvos diferentes, energizante, túnel, 3 vidas, níveis. Em todos: `p` pausa, `q` volta ao menu, WASD também.
- Recordes: no fim da partida o Client faz `surface.post({ type: 'score', game, score })`; o hook `ui.message` valida, grava em `$.store` (`gameHighs`) e responde `{ props }`.
- Sem `Client` (surface `vscode` ou `mobile`) ou com `ui.fault`, o pane mostra uma mensagem em vez do jogo.
- Desenho: célula de 2 colunas (`██`, `▓▓`, `▟▙` fantasma, `▐▌` comida). Pac-Man é `██` amarelo e parede `██` azul-acinzentado: só a cor diferencia.

## Sokoban (v0.6.0)

- 4º jogo em `hooks/games.js` (`GAMES`, `RULES.sokoban`, seção "Sokoban"). Menu agora aceita `1-4`. Pontuação: 100 por fase concluída; recorde em `gameHighs.sokoban` (`GAME_IDS` e o valor inicial de `gameHighs` no `register.js` ganharam `sokoban`).
- Fases em `SOKOBAN_LEVELS` (notação clássica `# $ . * @ +`), das mais fáceis para as mais difíceis, **todas conferidas com um solver BFS** (de 1 a 48 movimentos, 1 a 4 caixas, no máximo 9x8). Fase nova: conferir solvabilidade antes de entrar; as fases são originais, não copiadas de coleções publicadas.
- Sem relógio (`tick` devolve false): só anda quando aperta tecla. Setas/WASD movem e empurram uma caixa por vez; `r` reinicia a fase; ao fechar a fase aparece "FASE CONCLUÍDA" e espaço/Enter segue; zerar as 10 fases vira `over` com `won` ("TODAS AS FASES!").
- **Sem derrota**: o jeito de encerrar é `q`. Por isso `RULES.sokoban.saveOnQuit` faz o `q` gravar a pontuação das fases já feitas (os outros jogos continuam descartando ao sair).
- Desenho: parede `▒▒` apagada, jogador `██` ciano, caixa `▓▓` laranja (verde no destino), destino ` ○` verde.

## Painel principal (v0.7.0)

Ordem, de cima para baixo: nome do projeto · branch · modelo · **Atalhos** (grade 2x2: `HANDOFF`, `LER-HANDOFF`, `EXPLORER`, `GAME`) · Sessão (duração, prompts, custo) · Contexto (barra e tokens; `▸ composição` recolhida, de `session.usage({ breakdown: 'summary' })`) · Limites com tempo até renovar · Tarefas · Subagentes (`$.agent.list`; os dois só aparecem quando há conteúdo) · Git · MCP (`MCP  N ▸`, lista recolhida).

- **Removidos a pedido do usuário (v0.7.0)**: seção "Arquivos alterados" (o estado `files` e o rastreio de Edit/Write saíram do código; o Git já mostra o +/−), o texto de ajuda do `/painel` no rodapé e os atalhos `commit`/`testes`/`revisar`/`/compact`/`/clear`.
- **Setas recolhíveis**: `toggle:context` e `toggle:mcp`, começam recolhidas e o estado fica em `$.store` (`sections`).
- **Atalhos**: `HANDOFF` e `LER-HANDOFF` preenchem o prompt (`$.prompt.fill`, mode `replace`, **sem enviar**); o texto de `LER-HANDOFF` foi escrito por mim, ajustar se o usuário quiser outro. `EXPLORER` e `GAME` chamam `toggleExplorer`/`toggleGame` direto (não passam por `$.command.run`).
- **Cores por ambiente**: `detectApp` lê `$.env.get('ORCA_APP_VERSION')` (Orca) e `$.env.get('TERM_PROGRAM') === 'vscode'` (VS Code); o resto é `terminal`. Padrões: Orca `auto` (sem fundo próprio, segue o terminal do centro, que combina com os painéis cinzas do Orca), VS Code e terminal `dracula`. `/painel tema dracula|auto` grava só para o ambiente atual em `$.store` (`themes`: `{ orca, vscode, terminal }`); a chave antiga `theme` não é mais lida. Se o usuário quiser o cinza exato do Orca, criar paleta `cinza` com o hex dele.
- **Tema**: `dracula` (fundo `#282a36` com `minHeight = bodyRows`) ou `auto`. Os painéis Explorer e Fliperama usam a mesma paleta.
- **Cores e fonte**: o mod controla `color` e `backgroundColor` em `Box`/`Text`. A **fonte não é controlável**: vem do terminal (`terminal.integrated.fontFamily`). A borda e o título do pane são da moldura do Claude Code, não do mod.
- `$.ui.view({ agentId })` (abrir transcript de subagente) aparece no reference.md do skill, mas **não existe nos tipos desta build**. Subagentes é só texto, sem clique.
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

- **Não confiar nas setas para o fliperama**: sem o foco no `Client`, a ← sai da sessão (atalho nativo). Controle sempre por `w a s d`.
- `Client(...)` só aceita **objeto literal** nas props (`Client({ key, module, props, width, height })`); montar as props em outra função faz o módulo não carregar.
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

- A 0.7.0 e o handoff dela foram integrados na `main` por fast-forward; as branches `feature/painel-principal` e `feature/mais-jogos` apontam para commits que já estão na `main` e podem ser apagadas. Tag/Release mais recente: ver `git describe --tags` (a Release da 0.7.0 é criada junto com este ajuste). Repo privado: https://github.com/adrianosantostreina/claude-code-right-panel.
- `docs/prints/` (screenshot do usuário) segue sem commit, de propósito.
- Plugin **instalado no escopo user** pelo marketplace local `asa-right-panel` (aponta para esta pasta, então segue a branch em que ela estiver), habilitado, versão **0.8.0**. Trocar de branch muda o código que o plugin instalado carrega; reinstalar ao trocar.
- Testar uma versão nova sem mexer na instalada: abrir um terminal (no Orca, uma aba de terminal comum) na pasta do projeto e rodar `claude plugin disable right-panel@asa-right-panel` e `claude --plugin-dir ./right-panel`; ao terminar, `claude plugin enable right-panel@asa-right-panel`.

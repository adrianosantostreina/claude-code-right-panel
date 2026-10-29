# Ricochete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar o Ricochete como 5º jogo do fliperama `/game`, jogado com o mouse.

**Architecture:** A lógica pura (fases, desvio, passo da bolinha, início justo, cronômetro, cliques) fica em `right-panel/hooks/ricochete.js`, sem desenho e com o sorteio injetável, para ser testada direto. O `games.js` (o Client do fliperama) importa esse módulo, registra o jogo em `GAMES`/`RULES`, desenha o campo e passa a entregar cliques da partida ao jogo.

**Tech Stack:** ES modules do mod do Claude Code; testes com `claude-code/testing` (`claude plugin test`).

**Spec:** `docs/superpowers/specs/2026-10-28-ricochete-design.md`

## Global Constraints

- Regras de código do mod (CLAUDE.md): `$.ns.metodo(...)` por extenso, `on('evento')` com string literal, só ES modules, imports só do próprio plugin ou de `claude-code`.
- Casa = 2 colunas × 1 linha; campo 18×12 com borda → 36 colunas. O campo começa na 3ª linha do Client (cabeçalho + status, uma linha cada).
- Símbolos: parede `▒▒` (`COLORS.dim`), triângulo `◺ ` `◸ ` `◹ ` `◿ ` (`COLORS.yellow`), bolinha `● ` (`COLORS.pink`), buraco `██` em `#000000`, gol `  ` (vazio).
- Velocidade: 150 ms por casa nas fases 1–6, 120 ms nas 7–8, 100 ms nas 9–10. Fase 9: 60 s; fase 10: 45 s e no máximo 6 triângulos.
- Validar sempre: `claude plugin validate ./right-panel` e `cd right-panel && claude plugin test`.

## Review Focus

1. Clique fora do campo (cabeçalho, status, ajuda, à direita da coluna 35) não faz nada. → teste na Task 2.
2. Clique na casa da bolinha, em parede, buraco ou gol não faz nada. → teste na Task 1.
3. Bolinha batendo em parede logo depois de sair de um triângulo volta pelo caminho de entrada, sem atravessar a diagonal. → teste na Task 1.
4. Pausa (p ou perda de foco) congela a bolinha e o cronômetro. → teste na Task 1.
5. Com o limite atingido, ainda dá para girar e remover (5º clique e clique direito). → teste na Task 1.

---

### Task 1: Lógica do jogo em `ricochete.js`

**Files:**
- Create: `right-panel/hooks/ricochete.js`
- Test: `right-panel/tests/ricochete.test.ts`

**Interfaces:**
- Produces:
  - `RICOCHETE_LEVELS: { name: string, map: string[], time?: number, limit?: number }[]` — os 10 mapas do spec, literalmente.
  - `TRIANGLES = ['◺', '◸', '◹', '◿']` — índice = orientação (0 nasce, +1 = giro horário).
  - `deflect(shape: number, dir: 'up'|'down'|'left'|'right'): dir | null` — nova direção ao entrar no triângulo andando em `dir`; `null` = lado fechado.
  - `newRicochete(rand = Math.random): Game` e `loadRicochete(game, rand = Math.random): void`.
  - `Game = { id: 'ricochete', score, over, won, paused, level, cleared, lost: '' | 'buraco' | 'tempo', grid: string[], tris: number[][] (-1 = vazio), ball: { x, y, dir }, wait: number, timeLeft: number | null, rand }`.
  - `ricocheteStep(game): void` — um passo da bolinha.
  - `ricocheteTick(game, dt: number): boolean`, `ricocheteKey(game, key: string): boolean`, `ricocheteClick(game, x: number, y: number, button: 'left'|'right'|'middle'): boolean` — `x`/`y` em casas do campo.
  - `speedOf(level: number): number` (ms por casa).

- [ ] **Step 1: Escrever os testes que falham** (`tests/ricochete.test.ts`, importando de `../hooks/ricochete.js`):
  - `fases: 10 mapas 18×12, um gol na borda cada` — conferir `RICOCHETE_LEVELS.length === 10`, tamanhos, `G` só na borda, fase 9 `time: 60`, fase 10 `time: 45, limit: 6`.
  - `desvio: lados abertos viram 90°, fechados devolvem null` — tabela completa 4×4: `deflect(0,'left') === 'up'`, `deflect(0,'down') === 'right'`, `deflect(0,'right') === null`, `deflect(0,'up') === null`; ◸ (1): `left→down`, `up→right`; ◹ (2): `right→down`, `up→left`; ◿ (3): `right→up`, `down→left`; os demais `null`.
  - `passo: parede devolve a bolinha sem sair da casa`.
  - `passo: triângulo aberto desvia; fechado devolve como parede`.
  - `passo: batida logo depois do desvio refaz o caminho de entrada` — bolinha entra andando `left` num ◺ encostado na parede de cima; ela sobe, bate, e sai andando `right` pela casa por onde entrou.
  - `gol marca ponto e espera o espaço; buraco perde e o espaço reinicia limpo`.
  - `cronômetro zera e perde por tempo; pausa congela bolinha e relógio`.
  - `clique: põe ◺, gira até ◿, o 5º remove; direito remove; parede/buraco/gol/bolinha ignorados`.
  - `limite: fase 10 recusa o 7º triângulo, mas gira e remove`.
  - `início justo: 4 passos sem triângulo não caem em buraco nem no gol, e não começa ao lado de buraco` — 200 sorteios por fase com `Math.random`.
  - `r reinicia a fase; depois da 10ª o gol vira won/over`.
  - Para controlar o sorteio, os testes posicionam a bolinha direto (`game.ball = { x, y, dir }`) e zeram `game.wait`.

- [ ] **Step 2:** `cd right-panel && claude plugin test` → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `ricochete.js`.** Regras do passo (`ricocheteStep`):
  - Próxima casa `n = ball + dir`. Gol (`G`) → `score++`; se era a 10ª, `won = over = true`, senão `cleared = true`. Buraco (`O`) → bolinha entra e `lost = 'buraco'`.
  - Parede (`#`) ou triângulo com `deflect` = `null` → a bolinha fica; se a casa atual tem triângulo, `dir = deflect(triAtual, oposto(dir))`, senão `dir = oposto(dir)`.
  - Triângulo com saída → a bolinha entra em `n` e `dir` = saída.
  - Casa vazia → anda.
  - `ricocheteTick`: nada se `paused/cleared/lost/over`; desconta `timeLeft` (zerou → `lost = 'tempo'`) e acumula `dt` em `wait` até `speedOf(level)`, um passo por vez.
  - Início justo (`loadRicochete`): sorteia casa `.` sem buraco nas 8 vizinhas e direção; simula 4 passos num clone sem triângulos; recusa se cair em buraco/gol; até 500 tentativas, depois aceita a última casa válida.

- [ ] **Step 4:** `claude plugin test` → PASS nos testes novos.

- [ ] **Step 5: Commit** — `feat: lógica do Ricochete (fases, desvio, cliques, início justo)`.

### Task 2: Ricochete no fliperama

**Files:**
- Modify: `right-panel/hooks/games.js` (cabeçalho, `GAMES`, `onPointer`, `gameRows`, `RULES`)
- Modify: `right-panel/hooks/register.js` (`GAME_IDS`, comentário do topo)
- Modify: `right-panel/.claude-plugin/plugin.json` (versão `0.11.0`, descrição)
- Test: `right-panel/tests/right-panel.test.ts`

**Interfaces:**
- Consumes: tudo de `ricochete.js` (Task 1).
- Produces: `RULES.ricochete = { create, tick, key, click, rows, saveOnQuit: true, help }`; `onPointer` repassa `down` da partida a `rules.click(game, floor(x/2), y - 2, button)`.

- [ ] **Step 1: Escrever os testes que falham:**
  - `Ricochete: 5 no menu abre a fase 1 com campo, bolinha e gol` — `key '5'` → texto `/^Ricochete  pontos 0/` e `/fase 1\/10/`; uma linha com `●`.
  - `Ricochete: clique põe triângulo e o 5º remove; clique fora do campo não faz nada` — `pointer({ type: 'down', x: 2, y: 3, button: 'left' })` na casa (1,1) → `◺` desenhado; mais 4 cliques → some; clique em `y: 0` e em `x: 40` não muda o desenho. Se a bolinha sorteada estiver na casa (1,1), usar (2,2).
  - `Ricochete: sair com fase feita grava o recorde` — trocar `game` no teste de recorde: `gameHighs` passa a incluir `ricochete: 0`.
  - Atualizar os `toEqual` de `gameHighs` existentes para incluir `ricochete: 0`.

- [ ] **Step 2:** `claude plugin test` → FAIL.

- [ ] **Step 3: Implementar.**
  - `GAMES`: `{ id: 'ricochete', name: 'Ricochete', color: COLORS.purple }`.
  - `onPointer`: na tela de jogo, `down` sem pausa/fim chama `rules.click` quando existir.
  - Status do Ricochete: `GOL! ` + `espaço segue`; `CAIU NO BURACO! ` / `TEMPO ESGOTADO! ` + `espaço tenta de novo`; senão `fase N/10`, `· ⏱ Ns` quando houver tempo, `· △ usados/limite` quando houver limite (vermelho no limite).
  - `ricocheteRows(game)` em `games.js` com os símbolos das Global Constraints (bolinha por cima do triângulo).
  - `help`: `['clique põe e gira · direito tira', 'r reinicia · p pausa · q menu']`.
  - `register.js`: `GAME_IDS` com `'ricochete'`.
  - `plugin.json`: `0.11.0` e "Tetris, Snake, Pac-Man, Sokoban e Ricochete".

- [ ] **Step 4:** `claude plugin validate ./right-panel` e `claude plugin test` → tudo PASS.

- [ ] **Step 5: Commit** — `feat: Ricochete no fliperama, jogado com o mouse (v0.11.0)`. Instalar: `claude plugin marketplace update asa-right-panel` e `claude plugin update right-panel@asa-right-panel`.

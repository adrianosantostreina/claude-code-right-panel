# Handoff — Right Panel

## Onde paramos (2026-10-14)

A **v0.3.1** está commitada (`d806fc1` e o commit deste handoff) e **instalada no escopo user**. Ela valida (`claude plugin validate`) e passa nos 12 testes (`claude plugin test`).
É a v0.3.0 sem a seção "Próximo passo", removida a pedido do usuário (ver abaixo). A 0.3.0 chegou a ser instalada antes da remoção; a 0.3.1 substitui essa cópia.
Duas sessões trabalharam em paralelo neste repo em 2026-10-14. A mensagem do commit `d806fc1` ainda cita "próximo passo do handoff", mas o código commitado já está sem essa seção.

## Próximo passo concreto

1. Reiniciar o Claude Code para carregar a 0.3.1 instalada.
2. Conferir as seções novas (lista em "v0.3.0" abaixo) e o fundo Dracula.
3. Testar os botões de atalho, `/compact`, `/clear` e `/painel tema auto`.
4. Fazer o push quando o usuário pedir (`main` está à frente de `origin`).

## v0.3.0 / v0.3.1

Seções novas no painel, nesta ordem: Sessão (duração, prompts, custo) · Contexto + composição (`session.usage({ breakdown: 'summary' })`) · Limites com tempo até renovar (`↻ 2h10`) · Tarefas · Subagentes (`$.agent.list`) · Arquivos alterados · Git (↑/↓, último commit, +/− por arquivo, não rastreados) · MCP (conectados + contagem de uso) · Atalhos.

- **Tema**: `dracula` (padrão, fundo `#282a36` com `minHeight = bodyRows`) ou `auto` (cores do tema do Claude Code). Troca com `/painel tema dracula|auto`, gravado em `$.store` (`theme`). O Explorer usa a mesma paleta.
- **Atalhos**: botões `commit`, `handoff`, `testes`, `revisar` preenchem o prompt com `$.prompt.fill` (mode `replace`, **sem enviar**); botões `/compact` e `/clear` rodam o comando com `$.command.run`.
- **Ticker** de 15 s (`$.clock.every`) atualiza duração, reset dos limites e subagentes.
- **Seção "Próximo passo" removida (2026-10-14, pedido do usuário)**: a v0.3.0 tinha uma seção que lia a seção "Próximo passo" do handoff e mostrava no painel. O usuário viu ao vivo e achou que poluía demais. Foi retirada do código e dos testes (`refreshHandoff`/`nextStepLines`, `$.fs.exists`/`$.fs.read`). **Não reintroduzir** sem o usuário pedir. O botão de atalho `handoff` continua.
- **MCP**: servidores conectados vêm de `breakdown.mcpTools` + `$.tool.list()` (supera a limitação antiga de "só os usados"); a chave `serverKey` normaliza "claude.ai Gmail" e `claude_ai_Gmail` para a mesma coisa.
- Teste: `fs.exists` pode receber o caminho já absoluto (o teste do handoff aceita os dois).

## A validar ao vivo

- v0.3.0 (o usuário já viu o painel e gostou; falta confirmar os detalhes): fundo Dracula preenchendo o painel inteiro (`minHeight`), `flexWrap`/`columnGap` nas linhas de botões, `variant: 'secondary'`, se `$.command.run` de `clear`/`compact` funciona a partir de um botão, e se `$.agent.list` traz subagentes reais.
- `claude plugin validate` passa mas avisa **"gating hook without .catch"** em `tool.call` e `ui.close{id=right-panel}`. Avaliar se vale tratar.
- Ainda da v0.2.0: indentação por espaços no `label` do Button do Explorer e clique em pasta no terminal.
- Ainda da v0.1.0: formato real de `TaskCreate`/`TaskUpdate` (id lido do texto `#N`); `paddingX` e `wrap: 'truncate-end'` aceitos (se não, aparece `ui.render (Pane) refused: ...` no transcript).

## Explorer (v0.2.0)

- Segundo painel, id `explorer`, aberto/fechado por `/explorer` (não abre sozinho).
- Lê pastas com `$.fs.list` só quando são abertas; relê as pastas abertas depois de Edit/Write/MultiEdit/NotebookEdit/Bash.
- Clicar num arquivo copia o caminho relativo (`$.ui.copy`). Hotkeys `r` (atualizar) e `c` (recolher). Limite de 500 linhas; oculta só `.git`.
- Sem argumento, `$.fs.list()` chega ao hook como o caminho absoluto do diretório de trabalho.

## Decisões

- **Mod em vez de statusline/hooks externos**: só mod desenha painel (pane) dentro do Claude Code.
- **Abre sozinho no session.start**; se o usuário fecha (✕ ou `/painel`), grava `autoOpen=false` no `$.store` e não abre mais sozinho.
- **Estado reconstruído pelo transcript** (`$.session.messages()`) no início e depois de `/clear`, `/resume`, `/branch`.
- **Arquivos alterados** vêm das ferramentas Edit/Write/MultiEdit/NotebookEdit (não do git), para funcionar fora de repositório. A seção Git é separada e só aparece dentro de repositório.
- **Atalhos não enviam o prompt**, só preenchem — o usuário revisa e envia.
- Marketplace local `asa-right-panel` na raiz do repo, para instalar com escopo user.

## Armadilhas

- Nos testes (`claude-code/testing`), registrar `on(evento)` duas vezes derruba o módulo ("registered twice"): para trocar um stub padrão, passe-o em `overrides` do `stubSession`.
- Não instalar e desenvolver ao mesmo tempo: a cópia instalada fica em cache por versão. Desenvolver sempre com `--plugin-dir`, com a cópia instalada desabilitada.
- Nome do plugin não pode começar com `claude-`.
- `focus`, `closeOnEscape` em `$.ui.open` aceitam só `true`; passar `false` dá erro.

## Como rodar e validar

```bash
claude plugin validate ./right-panel
cd right-panel && claude plugin test
claude plugin disable right-panel@asa-right-panel
claude --plugin-dir "./right-panel"
```

Ao terminar: `claude plugin update right-panel@asa-right-panel` e `claude plugin enable right-panel@asa-right-panel`.

## Git e instalação

- Branch `main`, **à frente de `origin/main`, sem push** (commits de 2026-10-14). Repo privado: https://github.com/adrianosantostreina/claude-code-right-panel.
- Plugin **instalado no escopo user**: marketplace local `asa-right-panel` apontando para esta pasta, `right-panel@asa-right-panel` habilitado, versão **0.3.1**.

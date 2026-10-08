# Handoff — Right Panel

## Onde paramos (2026-10-07)

A primeira versão do mod está pronta, validada (`claude plugin validate`) e com 6 testes passando (`claude plugin test`).
**Ainda não foi vista rodando numa sessão real**: é o próximo passo.

## Próximo passo concreto

1. Abrir o Claude Code nesta pasta **com o mod carregado**, num terminal largo (144+ colunas) e em tela cheia:
   ```bash
   claude --plugin-dir "./right-panel"
   ```
2. Conferir com `/plugin` a linha `1 mod active · right-panel`.
3. Ver se o painel abriu sozinho à direita. Se não, rodar `/painel`.
4. Fazer o Claude editar um arquivo e criar tarefas, e ver se o painel atualiza.
5. Ajustar o visual pelo que aparecer. Com `--plugin-dir`, o mod recarrega sozinho ao salvar.
6. (Já instalado no escopo user; ver seção "Git e instalação".)

## Decisões

- **Mod em vez de statusline/hooks externos**: só mod desenha painel (pane) dentro do Claude Code.
- **Abre sozinho no session.start**; se o usuário fecha (✕ ou `/painel`), grava `autoOpen=false` no `$.store` e não abre mais sozinho.
- **Estado reconstruído pelo transcript** (`$.session.messages()`) no início e depois de `/clear`, `/resume`, `/branch`, para não zerar ao recarregar o mod.
- **Arquivos alterados** vêm das ferramentas Edit/Write/MultiEdit/NotebookEdit (não do git), para funcionar fora de repositório.
- **MCP**: não há API que liste os servidores conectados, então o painel mostra os **MCPs usados** na sessão (pelo prefixo `mcp__`).
- Marketplace local `asa-right-panel` na raiz do repo, para instalar com escopo user.

## Pendências / a validar na sessão real

- Formato real de `TaskCreate`/`TaskUpdate` (o id da tarefa é lido do texto do resultado, `#N`). Se as tarefas não aparecerem, olhar os tipos em `.claude-plugin/types/claude-code-tools/index.d.ts`.
- Se `$.ui.open` no `session.start` funciona como esperado (abre sozinho só com 144+ colunas).
- Se `paddingX` e `wrap: 'truncate-end'` são aceitos. Se o desenho for recusado, aparece a linha `ui.render (Pane) refused: ...` no transcript.
- Ideias para depois: mostrar +/- linhas por arquivo (git diff --numstat), subagentes ativos, duração da sessão, botões para abrir arquivo.

## Armadilhas

- Não instalar e desenvolver ao mesmo tempo: a cópia instalada fica em cache por versão. Desenvolver sempre com `--plugin-dir`.
- Nome do plugin não pode começar com `claude-`.
- `focus`, `closeOnEscape` em `$.ui.open` aceitam só `true`; passar `false` dá erro.

## Como rodar e validar

```bash
claude plugin validate ./right-panel
cd right-panel && claude plugin test
claude --plugin-dir "./right-panel"
```

## Git e instalação

- Branch `main`, sincronizada com `origin` (repo privado: https://github.com/adrianosantostreina/claude-code-right-panel).
- Plugin **instalado no escopo user** (2026-10-08): marketplace local `asa-right-panel` apontando para esta pasta, `right-panel@asa-right-panel` v0.1.0 habilitado. Vale para todos os projetos.
- Para testar mudanças com `--plugin-dir`, desabilite antes a cópia instalada (`claude plugin disable right-panel@asa-right-panel`) para não carregar duas vezes. Ao terminar: suba o `version` e rode `claude plugin update right-panel@asa-right-panel`.

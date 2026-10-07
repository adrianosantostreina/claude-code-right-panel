# CLAUDE.md

Projeto: **Right Panel**, um mod do Claude Code (painel lateral estilo OpenCode). Leia `docs/handoff.md` ao iniciar.

## Regras do código do mod (`right-panel/hooks/register.js`)

A análise estática do Claude Code exige:
- Chamadas da API sempre por extenso: `$.ns.metodo(...)`. Nunca `const ui = $.ui` nem desestruturar `$`.
- Nome do evento em `on(...)` sempre string literal. Um `on` por evento sem matcher.
- Funções que recebem `$` declaradas no topo do arquivo (não dentro de hooks, não importadas).
- Só ES modules; import só de arquivos do próprio plugin ou de `claude-code`.

Referência mais confiável: os tipos que o Claude Code grava em `right-panel/.claude-plugin/types/` ao carregar com `--plugin-dir`. Docs: https://code.claude.com/docs/en/plugins/mods/overview

## Validar sempre depois de mudar

```bash
claude plugin validate ./right-panel
cd right-panel && claude plugin test
```

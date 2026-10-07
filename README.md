# Claude Code Right Panel

Um painel lateral no estilo do OpenCode para o Claude Code, feito como **mod** (plugin com hooks em JavaScript).

Ele mostra, à direita da conversa:

- projeto, branch do git e modelo
- contexto usado (barra, tokens e %) e custo da sessão em US$
- limites do plano (5h / 7 dias)
- tarefas (TodoWrite ou TaskCreate/TaskUpdate)
- arquivos que o Claude alterou na sessão
- servidores MCP usados na sessão

Em terminal estreito, o painel fica acima do prompt. Quando abre sozinho, só aparece com 144 colunas ou mais; pelo `/painel` aparece em qualquer largura.

## Requisitos

- Claude Code v2.1.287 ou mais novo (testado na 2.1.292)
- Funciona no terminal e na aba Code do app Desktop. Na extensão do VS Code não desenha.

## Estrutura

```
.claude-plugin/marketplace.json   marketplace local "asa-right-panel"
right-panel/                      o mod
  .claude-plugin/plugin.json
  hooks/hooks.json                aponta para register.js
  hooks/register.js               todo o código
  tests/right-panel.test.ts       testes (claude plugin test)
```

## Desenvolver

```bash
claude --plugin-dir "./right-panel"     # carrega só nesta sessão, com hot reload
claude plugin validate ./right-panel    # análise estática
cd right-panel && claude plugin test    # testes
```

## Instalar (vale para todos os projetos)

```bash
claude plugin marketplace add "D:/6. Meus Projetos Pessoais/Claude Code Right Panel"
claude plugin install right-panel@asa-right-panel
```

Depois de mudar o código, suba o `version` em `plugin.json` e rode `claude plugin update right-panel@asa-right-panel`. A cópia instalada fica em cache por versão.

## Uso

- `/painel` abre e fecha o painel. A escolha fica salva para as próximas sessões.
- `Ctrl+X` e depois `Tab` dá o foco ao painel. `Ctrl+X` + setas redimensiona.

# Ricochete — 5º jogo do fliperama (`/game`)

Data: 2026-10-28 · Status: aprovado em conversa, aguardando plano

## Intenção

Um quebra-cabeça de ação para o fliperama do Right Panel. Uma bolinha anda sozinha em linha reta
pelo campo e o jogador a guia até o gol colocando e girando triângulos com o mouse. A graça está em
pensar rápido com a bolinha já andando: não há "montar e soltar".

O Adriano desenhou o jogo (dois esboços à mão) e aprovou o visual num protótipo no navegador:
campo compacto, triângulo vazado, buraco preto.

## Metas

- Ser o 5º jogo do `/game`, ao lado de Tetris, Snake, Pac-Man e Sokoban, com o mesmo jeito de
  menu, pausa, recorde e ajuda.
- Jogar com o mouse: clique põe e gira triângulos.
- 20 fases que vão ficando difíceis (paredes, buracos, cronômetro, limite de triângulos).

## Fora do escopo

- Fases geradas automaticamente, editor de fases, mais de 20 fases nesta versão.
- Rodar no VS Code: lá não existe Client e o fliperama já mostra a mensagem de que só roda no
  terminal/desktop. Nada muda nisso.
- A versão Electron é outro projeto, em outra sessão (ver `2026-10-28-ricochete-electron-prompt.md`).

## O que seria um fracasso mesmo funcionando

- A bolinha fazer curva ou andar na diagonal. Ela só anda em cima, baixo, esquerda e direita.
- O jogador perder logo no começo da fase sem ter tido chance de reagir.
- Uma fase sem solução.
- O clique cair na casa errada (desalinhamento entre o desenho e a conta da posição).

## Regras (decididas com o Adriano)

- **Início:** a bolinha começa numa casa vazia sorteada e já sai andando. A direção inicial também é
  sorteada entre as quatro.
- **Movimento:** só em linha reta, uma casa por passo. Ao bater em parede (borda ou parede
  interna), volta pelo mesmo caminho.
- **Triângulo:** clique esquerdo numa casa vazia põe um triângulo retângulo vazado. Clique esquerdo
  num triângulo gira 90°; depois das quatro posições, o clique seguinte (o 5º) remove o triângulo.
  Clique direito também remove, nos terminais que repassam esse clique — não dá para contar com
  ele no Orca/Windows Terminal, por isso o 5º clique é o caminho garantido.
- **Desvio:** o triângulo tem dois lados abertos e dois fechados (as pernas da quina reta). A
  bolinha que entra por um lado aberto bate na diagonal e sai pelo outro lado aberto. Se entrar por
  um lado fechado, volta como se fosse parede. Exemplo do esboço: bolinha andando para a esquerda
  bate no ◺ (quina embaixo à esquerda, lados abertos em cima e à direita) e sobe.
- **Gol:** uma abertura de uma casa na borda. A bolinha que entra nela marca o gol e a fase acaba.
- **Buraco preto:** a bolinha que entra nele cai e o jogador perde a fase.
- **Perder:** não há vidas. Perder (buraco ou tempo esgotado) reinicia a mesma fase.
- **Cronômetro:** nas fases 9, 10, 14, 17, 18, 19 e 20, contagem regressiva; zerou, perdeu.
- **Limite de triângulos:** máximo de triângulos no campo ao mesmo tempo: 6 na fase 10, 5 nas 15, 18 e 19, 4 na 20.
- **Recorde:** quantas fases o jogador passou, gravado como o do Sokoban.

## Desenho (aprovado no protótipo)

- Campo compacto: cada casa ocupa **2 colunas × 1 linha** do terminal, como no Sokoban.
- Campo de **18×12 casas com a borda** (16×10 por dentro) → 36 colunas de largura.
- Parede: `▒▒` na cor `dim`, igual ao Sokoban.
- Triângulo: **um símbolo vazado** por casa, amarelo — `◺` `◸` `◹` `◿` seguido de espaço. A quina
  reta mostra para onde ele está virado. Não usar blocos cheios (`▄█`, `▗█`): o Adriano rejeitou.
- Bolinha: `●` rosa. É a única coisa redonda na tela.
- Buraco: quadrado preto (`██` em preto). Não pode ser redondo, para não parecer uma segunda bolinha.
- Gol: abertura na borda (casa vazia no meio da parede), sem traves.
- Cabeçalho no padrão do fliperama: nome, fase N/20, cronômetro quando houver, triângulos usados
  / limite quando houver, recorde.

## As 10 fases (aprovadas)

`#` parede · `G` gol · `O` buraco · `.` vazio. 18 colunas × 12 linhas, borda incluída.

1. **Primeiro gol** — campo vazio, gol em cima.
```
########G#########
#................#
#................#
#................#
#................#
#................#
#................#
#................#
#................#
#................#
#................#
##################
```
2. **Pela lateral** — gol na parede da direita.
```
##################
#................#
#................#
#................G
#................#
#................#
#................#
#................#
#................#
#................#
#................#
##################
```
3. **Lá embaixo** — gol no canto de baixo, na esquerda.
```
##################
#................#
#................#
#................#
#................#
#................#
#................#
#................#
#................#
G................#
#................#
##################
```
4. **Pilar** — primeira parede interna.
```
############G#####
#................#
#................#
#................#
#.......#........#
#.......#........#
#.......#........#
#.......#........#
#.......#........#
#.......#........#
#................#
##################
```
5. **Prateleira** — uma parede tapa o gol por baixo.
```
########G#########
#................#
#................#
#....########....#
#................#
#................#
#................#
#................#
#................#
#................#
#................#
##################
```
6. **Ziguezague** — corredor entre duas paredes desencontradas.
```
##################
#.....#..........#
#.....#..........#
#.....#..........#
#.....#..........#
#.....#....#.....G
#.....#....#.....#
#..........#.....#
#..........#.....#
#..........#.....#
#..........#.....#
##################
```
7. **Buraco** — primeiro buraco preto.
```
###G##############
#................#
#................#
#................#
#................#
#.......O........#
#................#
#..#####.........#
#................#
#................#
#................#
##################
```
8. **Guardas** — dois buracos dos lados da entrada do gol.
```
##################
#.........#......#
#.........#......#
#.........#......#
#..............O.#
#................G
#..............O.#
#.........#......#
#.........#......#
#.........#......#
#.........#......#
##################
```
9. **Contra o relógio** — 60 segundos.
```
##################
#................#
#...O......#.....#
#..........#.....#
#..#####...#.....#
#................#
#.......O........#
#.....#######....#
#................#
#..........O.....#
#................#
#############G####
```
10. **Labirinto** — 45 segundos, no máximo 6 triângulos.
```
##################
G.....#..........#
#.....#....O.....#
#.....#..........#
#.....#####..#####
#................#
#..O.............#
####.....#####...#
#........#.......#
#........#...O...#
#................#
##################
```

## Fases 11 a 20 (2026-10-29)

Pedidas depois do jogo pronto. Usam só as peças que já existem; a dificuldade vem de corredores
mais estreitos, buracos de guarda na frente do caminho e relógio com limite juntos no fim. Velocidade
de 100 ms por casa, como nas 9–10. Um teste confere que de qualquer casa vazia há caminho até o gol
sem passar por buraco.

11. Telhado
```
########G#########
#................#
#...##########...#
#...#........#...#
#...#........#...#
#...#........#...#
#................#
#................#
#................#
#................#
#................#
##################
```
12. Ilhas
```
##################
#................#
#..##......##....#
#..##......##....#
#.......O........#
#................#
#....##.....##...G
#....##.....##...#
#.........O......#
#................#
#................#
##################
```
13. Funil
```
##################
#................#
#................#
##..............##
#.#.....O......#.#
#..#..........#..#
#...#........#...#
#....#......#....#
#.....#....#.....#
#......#..#......#
#................#
########G#########
```
14. Pente (60 s)
```
##################
#................#
#.#.#.#.#.#.#.#..#
#.#.#.#.#.#.#.#..#
#.#.#.#.#.#.#.#..#
#.#.#.#.#.#.#.#..#
#................#
#................#
#....O......O....#
#................#
#................G
##################
```
15. Cofre (máx. 5 triângulos)
```
##################
#................#
#................#
#................#
######...........#
#....#...........#
G....#...........#
#....#...........#
#.####...........#
#................#
#..O.............#
##################
```
16. Campo minado
```
#############G####
#................#
#..O.....O.......#
#..............O.#
#.....O..........#
#...........O....#
#..O.............#
#........O.......#
#..............O.#
#....O...........#
#..........O.....#
##################
```
17. Serpente (60 s)
```
##################
#................#
#................#
##############...#
#................#
#.......O........#
#...##############
#.....O..........#
#................#
##############...#
G................#
##################
```
18. Taça (50 s, máx. 5 triângulos)
```
##################
#................#
#..####....####..#
#..#..........#..#
#..#..O....O..#..#
#................#
#......####......#
#......#..#......#
#...O..#..#..O...#
#................#
#......O.O.......#
########G#########
```
19. Muralha (45 s, máx. 5 triângulos)
```
##################
#.......#........#
#.......#........G
#.......#...O....#
#.......#........#
#..O....#........#
#.......#######..#
#.......#........#
#.......#O.......#
#................#
#.......#O.......#
##################
```
20. Grande final (40 s, máx. 4 triângulos)
```
##G###############
#..#.............#
#..#..O......O...#
#..#.............#
#..#....######...#
#..#....#....#...#
#..#....#.O..#...#
#..#.............#
#..#........O....#
#...O............#
#................#
##################
```

## Onde entra no código

- `right-panel/hooks/games.js`: nova entrada em `GAMES` e em `RULES` (`create`, `tick`, `key`,
  `rows`, `help`), seguindo o Sokoban (fases, `saveOnQuit`, "FASE CONCLUÍDA").
- O Client já liga `surface.onPointer`, mas hoje só usa o clique no menu. O jogo precisa receber o
  clique durante a partida, com `x`/`y` da célula e o `button`. A partida começa 2 linhas abaixo
  do topo do Client (cabeçalho + status) e cada casa tem 2 colunas: casa = (`floor(x / 2)`, `y - 2`).
- Recorde pelo caminho que já existe (`surface.post` → hooks module → `$.store`).
- Testes em `right-panel/tests/right-panel.test.ts`, no estilo dos testes do fliperama.

## Decisões minhas (o builder pode rever)

- **Nome:** "Ricochete". O Adriano viu o nome nos esboços e não o rejeitou, mas também não o escolheu.
- **Velocidade:** 150 ms por casa nas fases 1–6, 120 ms nas 7–8 e 100 ms nas 9–10.
- **Início justo:** a casa e a direção sorteadas não podem levar a um buraco ou ao gol em menos de
  4 casas. Também não pode começar numa casa vizinha de buraco.
- **Primeiro giro:** o triângulo nasce como `◺` e gira no sentido horário: ◺ → ◸ → ◹ → ◿ → some.
- **Onde não dá para clicar:** parede, buraco, gol e a casa onde a bolinha está. Clicar nelas não
  faz nada. Isso evita girar um triângulo com a bolinha dentro dele.
- **Batida:** quando a bolinha volta (parede ou lado fechado), ela fica na mesma casa naquele passo
  e já inverte a direção. Duas paredes encostadas fazem a bolinha ir e vir, o que é esperado.
- **Ao perder:** a fase recomeça com o campo limpo (sem os triângulos), bolinha e direção novas, e o
  cronômetro cheio. O recomeço espera o espaço, com a mensagem "CAIU NO BURACO" ou "TEMPO
  ESGOTADO", para o jogador não perder de novo sem ver.
- **Ao fazer gol:** "GOL!" e o espaço passa à fase seguinte. Depois da 20ª: "TODAS AS FASES!".
- **Limite atingido:** clique em casa vazia não põe triângulo, e o contador no cabeçalho fica
  vermelho. Girar e remover continuam valendo.
- **Teclas:** `r` reinicia a fase, `p` pausa, `q` volta ao menu, espaço segue depois de gol ou
  derrota. O Esc devolve o teclado ao prompt e pausa, como nos outros jogos.
- **Pausa:** o cronômetro para junto com a bolinha.
- **Recorde:** conta fases passadas (1 por fase, sem os 100 pontos por fase do Sokoban). O id do
  jogo entra também em `GAME_IDS`, em `register.js`, para o recorde ser gravado.
- **Batida dentro do triângulo:** a volta por um lado fechado refaz o caminho de entrada.
- **Cabeçalho e status:** cada um cabe numa linha só (rótulos curtos), porque a conta do clique
  supõe o campo começando na 3ª linha do Client.

## Deixado ao builder

- Nomes de funções e estrutura interna dentro de `games.js`.
- Como sortear o início justo (tentativas com limite, ou lista de casas válidas).
- Os textos exatos das linhas de ajuda, desde que caibam em 36 colunas.

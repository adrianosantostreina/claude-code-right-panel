# Prompt: Ricochete em Electron (Windows)

Prompt para colar numa sessão nova do Claude Code, numa pasta vazia, para gerar a versão desktop
do jogo. É uma ideia de partida: ajuste à vontade.

---

Quero criar um jogo de quebra-cabeça para Windows chamado **Ricochete**, feito em **Electron**, com
o jogo desenhado num `<canvas>` (sem engine de jogo). Antes de escrever código, me faça as
perguntas que faltarem e proponha a estrutura do projeto.

## Como o jogo funciona

- O campo é uma grade de **16×10 casas**, cercada por uma borda de paredes.
- Uma **bolinha** começa numa casa vazia sorteada e já sai andando numa direção sorteada (cima,
  baixo, esquerda ou direita). Ela anda **uma casa por passo, só em linha reta**: nunca faz curva,
  nunca anda na diagonal.
- Ao bater numa **parede**, a bolinha volta pelo mesmo caminho.
- O jogador guia a bolinha com o **mouse**:
  - clique esquerdo numa casa vazia põe um **triângulo retângulo vazado** (só o contorno);
  - clique esquerdo num triângulo gira 90° no sentido horário; depois das quatro posições, o
    clique seguinte (o 5º) remove o triângulo;
  - clique direito num triângulo também o remove.
- **Desvio:** o triângulo tem dois lados abertos e dois fechados (as pernas da quina reta). A
  bolinha que entra por um lado aberto bate na diagonal e sai pelo outro lado aberto, virando 90°.
  Se entrar por um lado fechado, volta como se fosse parede. Exemplo: um triângulo com a quina
  reta embaixo à esquerda tem os lados abertos em cima e à direita; a bolinha que vem da direita,
  andando para a esquerda, bate nele e sobe.
- O **gol** é uma abertura de uma casa na borda. A bolinha que entra nele passa de fase.
- O **buraco preto** é uma casa onde a bolinha cai. Cair nele perde a fase.
- Não há vidas. Perder reinicia a mesma fase com o campo limpo, depois que o jogador aperta espaço
  (mensagens "CAIU NO BURACO" ou "TEMPO ESGOTADO").
- Algumas fases têm **cronômetro** regressivo (zerou, perdeu) e/ou um **limite de triângulos** no
  campo ao mesmo tempo; os valores estão junto de cada mapa abaixo.
- O início tem que ser justo: a casa e a direção sorteadas não podem levar a um buraco ou ao gol em
  menos de 4 casas, nem começar ao lado de um buraco.
- Velocidade: 150 ms por casa nas fases 1–6, 120 ms nas 7–8 e 100 ms da 9 em diante. Movimento suave
  entre casas no canvas é bem-vindo, mas a lógica continua casa a casa.
- Não dá para clicar em parede, buraco, gol nem na casa onde a bolinha está.
- Teclas: `R` reinicia a fase, `P` pausa, `Esc` volta ao menu, espaço segue depois de gol ou
  derrota.
- **Recorde:** quantas fases o jogador já passou, guardado localmente (arquivo JSON na pasta de
  dados do app).

## Visual

- Fundo escuro no tema Dracula: fundo `#282a36`, paredes `#6272a4`, bolinha `#ff79c6`, triângulos
  em contorno `#f1fa8c`, texto `#f8f8f2`.
- Triângulos **vazados** (só o contorno), não cheios. A quina reta mostra para onde ele está virado.
- O buraco é um **quadrado preto**, nunca redondo, para não parecer uma segunda bolinha.
- O gol é só uma abertura na borda, sem traves.
- No topo: nome do jogo, "fase N/20", cronômetro quando houver, triângulos usados/limite quando
  houver, recorde.
- A janela se adapta ao tamanho, mantendo as casas quadradas.

## As 20 fases

`#` parede · `G` gol · `O` buraco · `.` vazio. Cada mapa tem 18 colunas × 12 linhas, borda incluída.

1. Primeiro gol
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
2. Pela lateral
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
3. Lá embaixo
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
4. Pilar
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
5. Prateleira
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
6. Ziguezague
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
7. Buraco
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
8. Guardas
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
9. Contra o relógio (60 s)
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
10. Labirinto (45 s, máx. 6 triângulos)
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

## Técnica

- Electron com `contextIsolation` ligado e `nodeIntegration` desligado; o recorde passa por um
  `preload` com IPC.
- Lógica do jogo (grade, passo da bolinha, desvio, colisão) num módulo separado do desenho, com
  testes automatizados cobrindo principalmente o desvio nas 4 rotações × 4 direções de entrada.
- Gerar instalador para Windows com `electron-builder` (NSIS) e uma versão portátil.
- Me mostre o jogo rodando (`npm start`) antes de empacotar.

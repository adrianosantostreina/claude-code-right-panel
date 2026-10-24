// Relógio digital do Right Panel: dígitos em blocos (meio bloco, 3 linhas de altura), com segundos.
//
// Módulo de superfície de um Client (como o games.js): roda no thread de desenho
// do terminal, sem $, e usa o relógio de quadros (surface.every) para redesenhar
// só ele uma vez por segundo, sem mexer no resto do painel. A hora vem do Date
// do próprio módulo (horário local).

const COLORS = {
  hour: '#bd93f9',
  seconds: '#ff79c6',
  dim: '#6272a4',
  text: '#f8f8f2',
}

// Fonte 3x5; cada linha de cada dígito tem 3 colunas ('#' é bloco cheio).
const DIGITS = {
  0: ['###', '# #', '# #', '# #', '###'],
  1: ['  #', '  #', '  #', '  #', '  #'],
  2: ['###', '  #', '###', '#  ', '###'],
  3: ['###', '  #', '###', '  #', '###'],
  4: ['# #', '# #', '###', '  #', '  #'],
  5: ['###', '#  ', '###', '  #', '###'],
  6: ['###', '#  ', '###', '# #', '###'],
  7: ['###', '  #', '  #', '  #', '  #'],
  8: ['###', '# #', '###', '# #', '###'],
  9: ['###', '# #', '###', '  #', '###'],
}
const COLON = [' ', '#', ' ', '#', ' ']
const TEXT_ROWS = 3 // 5 linhas de pixel viram 3 linhas de texto (meio bloco em cima e embaixo)
const FULL_WIDTH = 27 // HH:MM:SS: 6 dígitos de 3 colunas, 2 dois-pontos e 7 espaços
const ONE_SECOND = 1000

export default function Relogio(props, surface) {
  const p = props || {}
  if (!surface.state) {
    // Primeira chamada: liga o relógio uma vez só.
    surface.every(ONE_SECOND, () => surface.setState({ at: Date.now() }))
    surface.setState({ at: Date.now() })
  }
  const at = new Date(surface.state ? surface.state.at : Date.now())
  const { Box, Text } = surface.elements

  const withSeconds = !surface.columns || surface.columns >= FULL_WIDTH
  const blink = at.getSeconds() % 2 === 0
  const parts = [
    ...pad2(at.getHours()).split('').map((d) => ({ glyph: DIGITS[d], color: p.color || COLORS.hour })),
    { glyph: COLON, color: blink ? p.color || COLORS.hour : COLORS.dim },
    ...pad2(at.getMinutes()).split('').map((d) => ({ glyph: DIGITS[d], color: p.color || COLORS.hour })),
  ]
  if (withSeconds) {
    parts.push(
      { glyph: COLON, color: blink ? COLORS.seconds : COLORS.dim },
      ...pad2(at.getSeconds()).split('').map((d) => ({ glyph: DIGITS[d], color: COLORS.seconds })),
    )
  }

  const lines = []
  for (let row = 0; row < TEXT_ROWS; row++) {
    const runs = []
    parts.forEach((part, i) => {
      const cells = halfBlocks(part.glyph[row * 2], part.glyph[row * 2 + 1])
      runs.push(Text({ color: part.color, children: cells }))
      if (i < parts.length - 1) runs.push(' ')
    })
    lines.push(Text({ wrap: 'truncate-end', children: runs }))
  }

  const root = { flexDirection: 'column' }
  if (p.bg) root.backgroundColor = p.bg
  return Box({ ...root, children: lines })
}

// Junta duas linhas de pixel numa de texto: ▀ só o de cima, ▄ só o de baixo, █ os dois.
function halfBlocks(top, bottom) {
  const below = bottom || ''
  let out = ''
  for (let i = 0; i < top.length; i++) {
    const up = top[i] === '#'
    const down = below[i] === '#'
    out += up && down ? '█' : up ? '▀' : down ? '▄' : ' '
  }
  return out
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

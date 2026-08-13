/**
 * Matemática de cor: conversão, composição e contraste.
 *
 * Está no código de produção, não só nos testes, porque o gerador de temas
 * usa a mesma conta para *construir* paletas legíveis — em vez de escolher
 * cores no olho e torcer para passarem depois.
 */

const NOMEADAS = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  none: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
};

function deHex(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) / 255 : 1 };
}

function deFuncao(texto) {
  const [r, g, b, a = 1] = texto
    .slice(texto.indexOf('(') + 1, texto.lastIndexOf(')'))
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map(Number);
  return { r, g, b, a };
}

/**
 * Todas as cores de um valor CSS. Cor sólida devolve uma; gradiente devolve
 * uma por parada — o contraste de um gradiente é o da sua pior parada.
 */
export function coresDe(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto) return [];
  const nomeada = NOMEADAS[texto.toLowerCase()];
  if (nomeada) return [nomeada];

  const achados = [];
  const re = /#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/gi;
  let m;
  while ((m = re.exec(texto)) !== null) {
    achados.push(m[0].startsWith('#') ? deHex(m[0]) : deFuncao(m[0]));
  }
  return achados;
}

/** Camada com alfa sobre um fundo opaco. */
export function compor(frente, fundo) {
  const a = frente.a ?? 1;
  return {
    r: frente.r * a + fundo.r * (1 - a),
    g: frente.g * a + fundo.g * (1 - a),
    b: frente.b * a + fundo.b * (1 - a),
    a: 1,
  };
}

function canal(v) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminancia({ r, g, b }) {
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razão de contraste da WCAG entre duas cores opacas. */
export function razao(c1, c2) {
  const l1 = luminancia(c1);
  const l2 = luminancia(c2);
  const [claro, escuro] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (claro + 0.05) / (escuro + 0.05);
}

/**
 * Pior contraste entre um valor de frente e um de fundo, considerando todas as
 * paradas de gradiente dos dois e compondo o alfa sobre `base`.
 */
export function piorRazao(frente, fundo, base) {
  const frentes = coresDe(frente);
  let fundos = coresDe(fundo);
  if (!fundos.length || fundos.every((c) => (c.a ?? 1) === 0)) fundos = [base];

  let pior = Infinity;
  for (const f of frentes) {
    for (const g of fundos) {
      const fundoReal = compor(g, base);
      pior = Math.min(pior, razao(compor(f, fundoReal), fundoReal));
    }
  }
  return pior === Infinity ? 0 : pior;
}

/** Primeira cor opaca de um valor de fundo, usada como base de composição. */
export function baseOpaca(valorFundo) {
  const cores = coresDe(valorFundo).filter((c) => (c.a ?? 1) > 0.9);
  return cores[0] ?? { r: 255, g: 255, b: 255, a: 1 };
}

/** A parada de fundo mais difícil de ler, entre todas do valor. */
export function fundoMaisDificil(valor, base) {
  const cores = coresDe(valor);
  if (!cores.length) return base;
  // "Mais difícil" depende da frente; usamos a de luminância mediana como
  // aproximação e deixamos a verificação final a cargo de `piorRazao`.
  const compostas = cores.map((c) => compor(c, base));
  compostas.sort((a, b) => luminancia(a) - luminancia(b));
  return compostas[Math.floor(compostas.length / 2)];
}

/* --------------------------------------------------------------------- HSL */

/** HSL (h em graus, s e l em %) para RGB. */
export function hslParaRgb(h, s, l) {
  const H = ((h % 360) + 360) % 360;
  const S = Math.min(100, Math.max(0, s)) / 100;
  const L = Math.min(100, Math.max(0, l)) / 100;
  const c = (1 - Math.abs(2 * L - 1)) * S;
  const x = c * (1 - Math.abs(((H / 60) % 2) - 1));
  const m = L - c / 2;
  const [r, g, b] =
    H < 60 ? [c, x, 0]
    : H < 120 ? [x, c, 0]
    : H < 180 ? [0, c, x]
    : H < 240 ? [0, x, c]
    : H < 300 ? [x, 0, c]
    : [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
    a: 1,
  };
}

export function paraHex({ r, g, b }) {
  const p = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}

export function hsl(h, s, l) {
  return paraHex(hslParaRgb(h, s, l));
}

/**
 * Cor de texto que **garante** o contraste pedido sobre um fundo.
 *
 * Caminha a luminosidade a partir de `lInicial` na direção indicada até a razão
 * fechar. É o que permite gerar centenas de paletas sem revisar cada uma no
 * olho: se nem o extremo resolver, devolve preto ou branco, que sempre resolve.
 *
 * @param {number} h matiz desejada para o texto
 * @param {number} s saturação desejada
 * @param {number} lInicial luminosidade preferida (a partida da busca)
 * @param {{r,g,b}} fundo cor opaca sobre a qual o texto vai aparecer
 * @param {number} minimo razão de contraste exigida
 * @param {'claro'|'escuro'} direcao para onde caminhar quando não fecha
 */
export function tintaSobre(h, s, lInicial, fundo, minimo, direcao = 'auto') {
  const rumo =
    direcao === 'auto' ? (luminancia(fundo) > 0.18 ? 'escuro' : 'claro') : direcao;
  const passo = rumo === 'claro' ? 3 : -3;

  let l = lInicial;
  for (let i = 0; i < 40; i += 1) {
    const cor = hslParaRgb(h, s, l);
    if (razao(cor, fundo) >= minimo) return paraHex(cor);
    l += passo;
    if (l > 100 || l < 0) break;
  }
  // Extremo do matiz não resolveu: cai para o neutro que sempre resolve.
  const branco = { r: 255, g: 255, b: 255 };
  const preto = { r: 0, g: 0, b: 0 };
  return razao(branco, fundo) >= razao(preto, fundo) ? '#ffffff' : '#000000';
}

/**
 * Fundo que **garante** o contraste pedido para uma tinta fixa.
 *
 * É a busca inversa de `tintaSobre`, e existe porque em elementos como a faixa
 * de seção a tinta não pode ceder: ela já é branca. Em matiz amarela ou verde,
 * branco sobre acento na luminosidade "bonita" não fecha 4.5 — quem tem de
 * escurecer é o fundo.
 *
 * @param {number} h matiz do fundo
 * @param {number} s saturação do fundo
 * @param {number} lInicial luminosidade preferida
 * @param {{r,g,b}} tinta cor do texto, que fica como está
 * @param {number} minimo razão exigida
 * @param {'claro'|'escuro'} direcao para onde empurrar o fundo
 * @returns {number} a luminosidade que fecha a conta
 */
export function luminosidadeDeFundo(h, s, lInicial, tinta, minimo, direcao = 'escuro') {
  const passo = direcao === 'claro' ? 3 : -3;
  let l = lInicial;
  for (let i = 0; i < 40; i += 1) {
    if (razao(hslParaRgb(h, s, l), tinta) >= minimo) return l;
    l += passo;
    if (l > 100 || l < 0) break;
  }
  return direcao === 'claro' ? 100 : 0;
}

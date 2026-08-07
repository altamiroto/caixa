/**
 * Cálculo de contraste, para os testes de tema.
 *
 * Existe porque paleta escrita à mão erra em silêncio: já aconteceu de um tema
 * ficar com tinta escura sobre linha escura, e só o olho pegou. Aqui a conta é
 * feita antes.
 *
 * Gradientes são avaliados parada a parada e vale a pior — um gradiente que
 * some numa das pontas é tão ruim quanto uma cor sólida ruim.
 */

const NOMEADAS = {
  transparent: { r: 0, g: 0, b: 0, a: 0 },
  white: { r: 255, g: 255, b: 255, a: 1 },
  black: { r: 0, g: 0, b: 0, a: 1 },
  none: { r: 0, g: 0, b: 0, a: 0 },
};

function deHex(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  if (h.length === 8) {
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
      a: parseInt(h.slice(6, 8), 16) / 255,
    };
  }
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
    a: 1,
  };
}

function deFuncao(texto) {
  const nums = texto
    .slice(texto.indexOf('(') + 1, texto.lastIndexOf(')'))
    .split(/[,\s/]+/)
    .filter(Boolean)
    .map(Number);
  const [r, g, b, a = 1] = nums;
  return { r, g, b, a };
}

/**
 * Todas as cores presentes num valor CSS.
 * Cor sólida devolve uma; gradiente devolve uma por parada.
 */
export function coresDe(valor) {
  const texto = String(valor ?? '').trim();
  if (!texto) return [];
  if (NOMEADAS[texto.toLowerCase()]) return [NOMEADAS[texto.toLowerCase()]];

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

export function razao(c1, c2) {
  const l1 = luminancia(c1);
  const l2 = luminancia(c2);
  const [claro, escuro] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (claro + 0.05) / (escuro + 0.05);
}

/**
 * Pior contraste entre um valor de frente e um de fundo, considerando todas as
 * paradas de gradiente dos dois e compondo o alfa sobre `base`.
 *
 * @param {string} frente valor CSS da cor do texto
 * @param {string} fundo  valor CSS do fundo imediato
 * @param {{r,g,b,a}} base fundo opaco atrás de tudo
 */
export function piorRazao(frente, fundo, base) {
  const frentes = coresDe(frente);
  let fundos = coresDe(fundo);

  // Fundo transparente/ausente: o que vale é o que está atrás.
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

/** Primeira cor opaca do fundo da página, usada como base de composição. */
export function baseOpaca(valorFundo) {
  const cores = coresDe(valorFundo).filter((c) => (c.a ?? 1) > 0.9);
  return cores[0] ?? { r: 255, g: 255, b: 255, a: 1 };
}

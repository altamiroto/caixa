/**
 * Leitura de preços.
 *
 * As listas reais trazem meia dúzia de formatos e vários erros de digitação.
 * Formatos já observados:
 *
 *   R$ 760 (10x)                  -> parcelado, total 760, 10 parcelas
 *   R$ 670 (Dinheiro)             -> à vista
 *   R$3.999 (10x Cartão)          -> parcelado, sem espaço depois do R$
 *   R$ 1. 330 (Dinheiro)          -> separador de milhar com espaço no meio
 *   10 x R$ 99,99 (R$ 999,99)     -> 10 parcelas de 99,99, total 999,99
 *   10 de R$ 278,00(R$ 2.780)     -> idem
 *   10 parcelas de R$ 67,69 (R$ 676,90) -> idem, por extenso
 *   6 parcelas de R$ 82,99        -> idem, sem total
 *   R$ 149,99 em até 6x no cartão -> parcelado, total 149,99, até 6x
 *   R$ 99 em até 3x               -> parcelado
 *   R$ 15                         -> preço único, sem rótulo
 *   R$ 3.999 (Dinheiro88          -> parêntese não fechado
 */

import { chave } from './normalize.js';

const RE_VALOR = /R\$\s*([\d][\d.,\s]*?)(?=\s*(?:[()\-–—]|$|[a-zA-ZÀ-ÿ]))/g;

/*
 * "10x R$ 99,99", "10 de R$ 278,00" e "6 parcelas de R$ 82,99" são a mesma
 * coisa escrita de três jeitos. Sem a variante por extenso, "6 parcelas de"
 * ficava no nome do produto e o valor da parcela era lido como preço final.
 */
const PARCELAS_PREFIXO = String.raw`(\d{1,2})\s*(?:x|(?:parcelas?\s+)?de)\s+R\$`;
const RE_PARCELAS_PREFIXO = new RegExp(PARCELAS_PREFIXO, 'i');

/** Onde começa um preço numa linha, incluindo o "6 parcelas de" que o precede. */
export const RE_INICIO_DE_PRECO = new RegExp(String.raw`${PARCELAS_PREFIXO}|R\$\s*\d`, 'i');
const RE_PARCELAS_SUFIXO = /(?:em\s+)?at[ée]\s*(\d{1,2})\s*x|\((\d{1,2})\s*x/i;
const RE_PARCELAS_SOLTO = /(\d{1,2})\s*x\b/i;

const PALAVRAS_AVISTA = ['dinheiro', 'pix', 'a vista', 'avista', 'especie', 'espécie'];
const PALAVRAS_PARCELADO = ['cartao', 'cartão', 'credito', 'crédito', 'parcelado', 'vezes'];

/**
 * Converte "1.599,90", "1. 330", "2899", "99,99", "4,350" em número.
 *
 * Há fornecedor que usa vírgula como separador de milhar ("R$ 4,350"), então
 * ponto e vírgula não decidem sozinhos. Quem decide é o último separador:
 * centavos sempre têm duas casas, então dois dígitos depois dele são
 * centavos e três são milhar ("1.020" = 1020, "4,350" = 4350).
 */
export function paraNumero(bruto) {
  const s = String(bruto).replace(/\s/g, '').replace(/[^\d.,]/g, '').replace(/[.,]+$/, '');
  if (!s) return null;

  const ultimo = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  let limpo = s;
  if (ultimo >= 0) {
    const inteiro = s.slice(0, ultimo).replace(/[.,]/g, '');
    const depois = s.slice(ultimo + 1);
    limpo = depois.length >= 3 ? inteiro + depois : `${inteiro}.${depois}`;
  }
  const n = Number.parseFloat(limpo);
  return Number.isFinite(n) ? n : null;
}

/*
 * Preço solto no fim da linha, sem "R$" — as listas de atacado escrevem
 * "Moto G06 4/256gb - Verde/Bege - 755" e "Mi Band 5 - Preta - 129,99".
 *
 * Exige espaço de um dos lados do traço: "- 755" e "Titanium- 1970" são
 * preço, mas "Agold CA45-6" é código de modelo.
 */
const RE_PRECO_SOLTO_FINAL = /(?:\s[-–—]\s*|\s*[-–—]\s)(\d{1,3}(?:[.,]\d{3})+(?:,\d{2})?|\d+(?:,\d{2})?)\s*$/;

/**
 * Procura um preço solto no fim do texto.
 * @returns {{ preco: import('../model/schema.js').Preco, indice: number } | null}
 */
export function precoSoltoNoFim(texto) {
  const m = String(texto).match(RE_PRECO_SOLTO_FINAL);
  if (!m) return null;
  const valor = paraNumero(m[1]);
  if (valor === null || valor < 1) return null;
  return {
    indice: m.index,
    preco: {
      valor,
      parcelas: null,
      valorParcela: null,
      tipo: 'avista',
      // Sem palavra nenhuma dizendo se é dinheiro ou cartão.
      explicito: false,
      rotulo: '',
      bruto: m[0].trim(),
    },
  };
}

const PALAVRAS_DE_PRECO = /\b(?:dinheiro|pix|cartao|credito|debito|a vista|avista|vista|especie|parcelas?|parcelado|vezes|em|ate|ema|no|na|de|sem|juros|total|ou|e|x)\b/g;

/**
 * A linha é só preço ("R$ 1.720 (10x Cartão)"), ou é um produto com preço
 * ("Galaxy A07 - R$ 645")? Tira valores, números e as palavras de pagamento;
 * se sobrar quase nada, é só preço.
 */
export function ehSoPreco(texto) {
  const resto = chave(texto)
    .replace(/r\$\s*[\d.,\s]+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(PALAVRAS_DE_PRECO, ' ')
    .replace(/[^a-z]/g, '');
  return resto.length <= 3;
}

/** Todos os valores em R$ presentes num trecho, na ordem de aparição. */
export function valoresEm(texto) {
  RE_VALOR.lastIndex = 0;
  const achados = [];
  let m;
  while ((m = RE_VALOR.exec(texto)) !== null) {
    const n = paraNumero(m[1]);
    if (n !== null && n > 0) achados.push({ valor: n, indice: m.index });
  }
  return achados;
}

/** Existe alguma menção a preço aqui? Usado para classificar linhas. */
export function pareceLinhaDePreco(texto) {
  return /R\$\s*\d/.test(texto) || RE_PARCELAS_PREFIXO.test(texto.trimStart());
}

/**
 * Decide se o preço é à vista ou parcelado.
 *
 * `explicito` diz se a decisão veio de uma palavra escrita na linha
 * ("Dinheiro", "Cartão", "6x") ou de um chute. Um preço solto no fim do nome
 * é um chute; quem manda é a linha que diz "(Dinheiro/pix)".
 */
function detectarTipo(texto, parcelas) {
  const k = chave(texto);
  const avista = PALAVRAS_AVISTA.some((p) => k.includes(p));
  const parcelado = PALAVRAS_PARCELADO.some((p) => k.includes(p));

  // "Dinheiro" ganha de "cartão" só quando não há contagem de parcelas junto.
  if (avista && !parcelas) return { tipo: 'avista', explicito: true };
  if (parcelado || parcelas) return { tipo: 'parcelado', explicito: true };
  if (avista) return { tipo: 'avista', explicito: true };
  return { tipo: null, explicito: false };
}

function extrairRotulo(texto) {
  // Prefere o conteúdo entre parênteses; sem ele, o que sobra depois do valor.
  const par = texto.match(/\(([^)]*)\)?\s*$/);
  if (par && par[1].trim()) return par[1].trim().replace(/\d+$/, '').trim();
  const cauda = texto.replace(/^.*?R\$\s*[\d.,\s]+/, '').trim();
  return cauda.replace(/^[-–—:]\s*/, '').trim();
}

/**
 * Lê uma linha de preço.
 *
 * @param {string} texto Linha já sem markup do WhatsApp
 * @returns {import('../model/schema.js').Preco|null}
 */
export function lerPreco(texto) {
  const valores = valoresEm(texto);
  const prefixo = texto.match(RE_PARCELAS_PREFIXO);
  const sufixo = texto.match(RE_PARCELAS_SUFIXO);

  let parcelas = null;
  if (prefixo) parcelas = Number(prefixo[1]);
  else if (sufixo) parcelas = Number(sufixo[1] ?? sufixo[2]);
  else {
    const solto = texto.match(RE_PARCELAS_SOLTO);
    if (solto) parcelas = Number(solto[1]);
  }

  if (!valores.length) return null;

  let valor;
  let valorParcela = null;

  if (prefixo && valores.length >= 2) {
    // "10 x R$ 99,99 (R$ 999,99)" — primeiro é a parcela, segundo é o total.
    valorParcela = valores[0].valor;
    valor = valores[valores.length - 1].valor;
  } else if (prefixo && valores.length === 1) {
    // "10 x R$ 99,99" sem total: deduz o total.
    valorParcela = valores[0].valor;
    valor = Math.round(valorParcela * parcelas * 100) / 100;
  } else {
    valor = valores[0].valor;
  }

  const detectado = detectarTipo(texto, parcelas);
  const tipo = detectado.tipo ?? (parcelas ? 'parcelado' : 'avista');
  if (tipo === 'parcelado' && parcelas && valorParcela === null) {
    valorParcela = Math.round((valor / parcelas) * 100) / 100;
  }

  return {
    valor,
    parcelas: tipo === 'parcelado' ? parcelas : null,
    valorParcela: tipo === 'parcelado' ? valorParcela : null,
    tipo,
    explicito: detectado.explicito,
    rotulo: extrairRotulo(texto),
    bruto: texto,
  };
}

/** Formata para exibição no catálogo: 1330 -> "1.330", 99.9 -> "99,90". */
export function formatarValor(valor, { comCentavos = 'auto' } = {}) {
  if (valor === null || valor === undefined) return '';
  const mostrarCentavos =
    comCentavos === true || (comCentavos === 'auto' && Math.round(valor) !== valor);
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: mostrarCentavos ? 2 : 0,
    maximumFractionDigits: mostrarCentavos ? 2 : 0,
  });
}

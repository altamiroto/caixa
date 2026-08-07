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
 *   R$ 149,99 em até 6x no cartão -> parcelado, total 149,99, até 6x
 *   R$ 99 em até 3x               -> parcelado
 *   R$ 15                         -> preço único, sem rótulo
 *   R$ 3.999 (Dinheiro88          -> parêntese não fechado
 */

import { chave } from './normalize.js';

const RE_VALOR = /R\$\s*([\d][\d.,\s]*?)(?=\s*(?:[()\-–—]|$|[a-zA-ZÀ-ÿ]))/g;
const RE_PARCELAS_PREFIXO = /(\d{1,2})\s*(?:x|de)\s+R\$/i;
const RE_PARCELAS_SUFIXO = /(?:em\s+)?at[ée]\s*(\d{1,2})\s*x|\((\d{1,2})\s*x/i;
const RE_PARCELAS_SOLTO = /(\d{1,2})\s*x\b/i;

const PALAVRAS_AVISTA = ['dinheiro', 'pix', 'a vista', 'avista', 'especie', 'espécie'];
const PALAVRAS_PARCELADO = ['cartao', 'cartão', 'credito', 'crédito', 'parcelado', 'vezes'];

/**
 * Converte "1.599,90", "1. 330", "2899", "99,99" em número.
 *
 * Regra pt-BR: vírgula é decimal, ponto é milhar. Um ponto sozinho com
 * exatamente 3 dígitos depois é milhar ("1.020" = 1020), não decimal.
 */
export function paraNumero(bruto) {
  let s = String(bruto).replace(/\s/g, '').replace(/[^\d.,]/g, '');
  if (!s) return null;

  const temVirgula = s.includes(',');
  if (temVirgula) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    const partes = s.split('.');
    if (partes.length > 1) {
      const ultima = partes[partes.length - 1];
      // "1.020" / "1.599.900" -> milhar. "99.9" -> decimal solto.
      s = ultima.length === 3 ? partes.join('') : `${partes.slice(0, -1).join('')}.${ultima}`;
    }
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
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
  return /R\$\s*\d/.test(texto) || /^\s*\d{1,2}\s*(?:x|de)\s+R\$/i.test(texto);
}

function detectarTipo(texto, parcelas) {
  const k = chave(texto);
  const avista = PALAVRAS_AVISTA.some((p) => k.includes(p));
  const parcelado = PALAVRAS_PARCELADO.some((p) => k.includes(p));

  // "Dinheiro" ganha de "cartão" só quando não há contagem de parcelas junto.
  if (avista && !parcelas) return 'avista';
  if (parcelado || parcelas) return 'parcelado';
  if (avista) return 'avista';
  return null;
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

  const tipo = detectarTipo(texto, parcelas) ?? (parcelas ? 'parcelado' : 'avista');
  if (tipo === 'parcelado' && parcelas && valorParcela === null) {
    valorParcela = Math.round((valor / parcelas) * 100) / 100;
  }

  return {
    valor,
    parcelas: tipo === 'parcelado' ? parcelas : null,
    valorParcela: tipo === 'parcelado' ? valorParcela : null,
    tipo,
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

/**
 * Montagem do HTML do catálogo.
 *
 * A saída é sempre uma lista de páginas 9:16. Quem decide *quantas* páginas e
 * com que escala é `../layout/paginate.js` — aqui só desenhamos o que mandaram.
 */

import { formatarValor } from '../parser/precos.js';
import { varsCss } from '../themes/temas.js';

export const LARGURA = 1080;
export const ALTURA = 1920;

export function escapar(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Decide a estrutura de colunas a partir do que o catálogo realmente tem.
 * Coluna sem conteúdo não é desenhada — é o que evita o "buraco" na direita
 * em listas sem cor, como a de TVs.
 */
export function definirColunas(catalogo, opcoes = {}) {
  const { resumo } = catalogo;
  const mostrarCor = opcoes.mostrarCor ?? resumo.temCores;
  const precos = [];
  if (resumo.temParcelado) precos.push('parcelado');
  if (resumo.temAvista) precos.push('avista');
  if (!precos.length) precos.push('avista');
  return { mostrarCor, precos };
}

function rotuloParcelado(catalogo) {
  // Usa o nº de parcelas mais comum da lista ("10x", "6x") no cabeçalho.
  const contagem = new Map();
  for (const secao of catalogo.secoes) {
    for (const p of secao.produtos) {
      const n = p.parcelado?.parcelas;
      if (n) contagem.set(n, (contagem.get(n) ?? 0) + 1);
    }
  }
  if (!contagem.size) return { titulo: 'Cartão', sub: '' };
  const [maisComum] = [...contagem.entries()].sort((a, b) => b[1] - a[1])[0];
  return { titulo: 'Cartão', sub: `em até ${maisComum}x` };
}

function htmlPreco(preco, classe, mostrarParcela) {
  if (!preco) return `<div class="linha__preco linha__preco--${classe} linha__preco--vazio">—</div>`;
  const valor = formatarValor(preco.valor);
  const parcela =
    mostrarParcela && preco.parcelas && preco.valorParcela
      ? `<span class="linha__parcela">${preco.parcelas}x ${formatarValor(preco.valorParcela, {
          comCentavos: true,
        })}</span>`
      : '';
  return `<div class="linha__preco linha__preco--${classe}">${escapar(valor)}${parcela}</div>`;
}

/** HTML de uma linha de produto. */
export function htmlProduto(produto, colunas, opcoes = {}) {
  const selo = produto.lancamento ? `<span class="linha__selo">NOVO</span>` : '';
  const obs = produto.observacao
    ? `<span class="linha__obs">${escapar(produto.observacao)}</span>`
    : '';
  const nome = `<div class="linha__nome">${selo}${escapar(produto.nome)}${obs}</div>`;

  const cor = colunas.mostrarCor
    ? produto.cores.length
      ? `<div class="linha__cor">${escapar(produto.cores.join(' / '))}</div>`
      : `<div class="linha__cor linha__cor--vazio"></div>`
    : '';

  const precos = colunas.precos
    .map((tipo) => htmlPreco(produto[tipo], tipo, opcoes.mostrarParcela ?? true))
    .join('');

  return `<div class="linha grade">${nome}${cor}${precos}</div>`;
}

/** HTML de um título de seção. */
export function htmlSecao(titulo, continuacao = false) {
  const cont = continuacao ? `<span class="secao__cont">(continuação)</span>` : '';
  return `<div class="secao">${escapar(titulo)}${cont}</div>`;
}

/** Cabeçalho da página. */
export function htmlCabecalho(catalogo, opcoes = {}) {
  const sobretitulo = opcoes.sobretitulo ?? 'Lista de produtos';
  const data = catalogo.data
    ? `<div class="cabecalho__data">${escapar(catalogo.data)}</div>`
    : '';
  const subtitulo =
    opcoes.mostrarSubtitulo !== false && catalogo.subtitulo
      ? `<div class="cabecalho__subtitulo">${escapar(catalogo.subtitulo)}</div>`
      : '';
  return `<header class="cabecalho">
    <div class="cabecalho__sobretitulo">${escapar(sobretitulo)}</div>
    <h1 class="cabecalho__titulo">${escapar(catalogo.titulo)}</h1>
    ${data}
    ${subtitulo}
  </header>`;
}

/** Faixa com os nomes das colunas. */
export function htmlRotulos(catalogo, colunas) {
  const parcelado = rotuloParcelado(catalogo);
  const celulas = [`<div>Produto</div>`];
  if (colunas.mostrarCor) celulas.push(`<div class="rotulos__preco">Cor</div>`);
  for (const tipo of colunas.precos) {
    celulas.push(
      tipo === 'parcelado'
        ? `<div class="rotulos__preco">${parcelado.titulo}<small>${escapar(parcelado.sub)}</small></div>`
        : `<div class="rotulos__preco">Dinheiro<small>/ Pix</small></div>`,
    );
  }
  return `<div class="rotulos grade">${celulas.join('')}</div>`;
}

/** Rodapé com marca e contador de páginas. */
export function htmlRodape(opcoes, numero, total) {
  const marca = opcoes.marca ? escapar(opcoes.marca) : '';
  const contador = total > 1 ? `${numero}/${total}` : '';
  return `<footer class="rodape">
    <span class="rodape__marca">${marca}</span>
    <span class="rodape__pagina">${contador}</span>
  </footer>`;
}

/**
 * Uma página completa.
 *
 * @param {Object} params
 * @param {import('../model/schema.js').Catalogo} params.catalogo
 * @param {string[]} params.blocos HTML já pronto das linhas/seções
 * @param {number} params.numero
 * @param {number} params.total
 * @param {number} params.escala
 */
export function htmlPagina({ catalogo, colunas, blocos, numero, total, escala, opcoes = {} }) {
  const estilo = [
    varsCss(opcoes.tema, opcoes.varsExtras),
    `--escala:${escala}`,
    opcoes.fundo ? `--fundo:${opcoes.fundo}` : '',
  ]
    .filter(Boolean)
    .join(';');

  return `<article class="pagina" style="${estilo}"
    data-cores="${colunas.mostrarCor ? 'sim' : 'nao'}"
    data-precos="${colunas.precos.length}"
    data-pagina="${numero}">
    <div class="pagina__brilho"></div>
    ${htmlCabecalho(catalogo, opcoes)}
    ${htmlRotulos(catalogo, colunas)}
    <div class="corpo">${blocos.join('')}</div>
    ${htmlRodape(opcoes, numero, total)}
  </article>`;
}

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

/**
 * Escala do cabeçalho a partir da escala do corpo.
 *
 * Sem isso, uma lista de 42 produtos comprime a tabela *e* o título junto, e o
 * catálogo fica com cara de planilha. O título só acompanha até certo ponto.
 */
export function escalaCabecalho(escala) {
  return Math.min(1.15, Math.max(0.78, escala * 0.45 + 0.5));
}

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
  return { mostrarCor, precos, parcelasDominante: parcelasDominante(catalogo) };
}

/** Nº de parcelas mais frequente da lista ("10x" na maioria dos casos). */
function parcelasDominante(catalogo) {
  const contagem = new Map();
  for (const secao of catalogo.secoes) {
    for (const p of secao.produtos) {
      const n = p.parcelado?.parcelas;
      if (n) contagem.set(n, (contagem.get(n) ?? 0) + 1);
    }
  }
  if (!contagem.size) return null;
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function rotuloParcelado(colunas) {
  const n = colunas.parcelasDominante;
  return { titulo: 'Cartão', sub: n ? `em até ${n}x` : '' };
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

  // Produto com um preço só (fone, carregador) repete o valor nas duas colunas
  // em vez de deixar uma delas com um traço.
  const unico = produto.avista ?? produto.parcelado;

  // A sublinha "10x 76,00" só aparece quando o produto foge do parcelamento
  // dominante — para o resto, o cabeçalho da coluna já diz "em até 10x".
  // Repetir em todas as linhas custa ~11px cada, o que numa lista de 42
  // produtos é a diferença entre uma página e duas.
  const parcelas = produto.parcelado?.parcelas ?? null;
  const mostrarParcela =
    opcoes.mostrarParcela ?? (parcelas !== null && parcelas !== colunas.parcelasDominante);

  const precos = colunas.precos
    .map((tipo) => htmlPreco(produto[tipo] ?? unico, tipo, mostrarParcela))
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
  const parcelado = rotuloParcelado(colunas);
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
    // O cabeçalho encolhe bem menos que a tabela: numa lista longa a tabela
    // fica compacta, mas o título continua sendo a chamada do story.
    `--escala-cabecalho:${escalaCabecalho(escala).toFixed(4)}`,
    opcoes.fundo ? `--fundo:${opcoes.fundo}` : '',
    opcoes.veu ? `--foto-veu:${opcoes.veu}` : '',
  ]
    .filter(Boolean)
    .join(';');

  // A foto entra como camada de fundo da página inteira, não como imagem de um
  // produto específico. O véu por cima é o que mantém o texto legível.
  const foto = opcoes.fundoImagem
    ? `<div class="pagina__foto" style="background-image:url('${String(opcoes.fundoImagem).replace(
        /'/g,
        "\\'",
      )}')"></div>`
    : '';

  return `<article class="pagina" style="${estilo}"
    data-cores="${colunas.mostrarCor ? 'sim' : 'nao'}"
    data-precos="${colunas.precos.length}"
    data-pagina="${numero}">
    ${foto}
    <div class="pagina__brilho"></div>
    ${htmlCabecalho(catalogo, opcoes)}
    ${htmlRotulos(catalogo, colunas)}
    <div class="corpo">${blocos.join('')}</div>
    ${htmlRodape(opcoes, numero, total)}
  </article>`;
}

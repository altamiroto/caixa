/**
 * Paginação e ajuste de escala.
 *
 * O requisito "não pode ter estrutura quebrada" não se resolve chutando quantos
 * produtos cabem por página: nome de produto quebra em 1, 2 ou 3 linhas
 * dependendo do texto e da fonte. Então medimos de verdade, no DOM, e só
 * depois decidimos onde cortar.
 *
 * Algoritmo:
 *   1. Para uma escala candidata, renderiza tudo num medidor fora da tela e lê
 *      a altura real de cada linha.
 *   2. Distribui as linhas em páginas, respeitando o espaço livre.
 *   3. Busca binária na escala: para N páginas, acha a maior escala que ainda
 *      cabe em N. Começa com N=1 e sobe até achar solução.
 *   4. Sobra vertical vira espaçamento entre linhas, até um limite — assim uma
 *      lista curta não fica espremida no topo.
 *
 * Funciona igual no navegador e no Playwright: os dois têm DOM.
 */

import { htmlPagina, htmlProduto, htmlSecao, definirColunas, ALTURA } from '../render/template.js';

export const ESCALA_MIN = 0.55;
export const ESCALA_MAX = 1.15;
const MAX_PAGINAS = 40;
const FOLGA_PX = 1; // margem de segurança contra arredondamento sub-pixel

/** Achata o catálogo numa sequência linear de blocos renderizáveis. */
function montarItens(catalogo, colunas, opcoes) {
  const itens = [];
  for (const secao of catalogo.secoes) {
    if (secao.titulo) {
      itens.push({ tipo: 'secao', titulo: secao.titulo, html: htmlSecao(secao.titulo) });
    }
    for (const produto of secao.produtos) {
      itens.push({
        tipo: 'produto',
        produto,
        secao: secao.titulo,
        html: htmlProduto(produto, colunas, opcoes),
      });
    }
  }
  return itens;
}

function obterMedidor(documento) {
  let host = documento.querySelector('#gc-medidor');
  if (!host) {
    host = documento.createElement('div');
    host.id = 'gc-medidor';
    host.className = 'medidor';
    documento.body.appendChild(host);
  }
  return host;
}

function alturaComMargem(el, janela) {
  const estilo = janela.getComputedStyle(el);
  return (
    el.getBoundingClientRect().height +
    Number.parseFloat(estilo.marginTop || 0) +
    Number.parseFloat(estilo.marginBottom || 0)
  );
}

/**
 * Mede, numa escala, o espaço disponível e a altura de cada bloco.
 * @returns {{disponivel:number, alturas:number[], margens:number[], gap:number, alturaSecao:number}}
 */
function medir(documento, janela, { catalogo, colunas, itens, escala, opcoes }) {
  const host = obterMedidor(documento);
  host.innerHTML = htmlPagina({
    catalogo,
    colunas,
    blocos: itens.map((i) => i.html),
    numero: 1,
    total: 2, // força o contador no rodapé: reserva o espaço do pior caso
    escala,
    opcoes,
  });

  const pagina = host.firstElementChild;
  const estiloPagina = janela.getComputedStyle(pagina);
  const corpo = pagina.querySelector('.corpo');
  const gap = Number.parseFloat(janela.getComputedStyle(corpo).rowGap || 0);

  const fixo =
    Number.parseFloat(estiloPagina.paddingTop || 0) +
    Number.parseFloat(estiloPagina.paddingBottom || 0) +
    alturaComMargem(pagina.querySelector('.cabecalho'), janela) +
    alturaComMargem(pagina.querySelector('.rotulos'), janela) +
    alturaComMargem(pagina.querySelector('.rodape'), janela);

  const filhos = [...corpo.children];
  const alturas = filhos.map((el) => el.getBoundingClientRect().height);
  const margens = filhos.map((el) => {
    const s = janela.getComputedStyle(el);
    return Number.parseFloat(s.marginTop || 0) + Number.parseFloat(s.marginBottom || 0);
  });

  // Altura de um título de seção nesta escala: usada para reservar o espaço da
  // faixa "(continuação)" no topo das páginas seguintes.
  const iSecao = itens.findIndex((i) => i.tipo === 'secao');
  const alturaSecao = iSecao >= 0 ? alturas[iSecao] + margens[iSecao] + gap : 0;

  return { disponivel: ALTURA - fixo - FOLGA_PX, alturas, margens, gap, alturaSecao };
}

/**
 * Distribui os blocos em páginas.
 *
 * Reserva incondicionalmente o espaço da faixa de continuação nas páginas
 * seguintes quando o catálogo tem seções — é conservador por um punhado de
 * pixels e, em troca, torna impossível a última linha vazar.
 *
 * @returns {number[][]|null} índices por página, ou null se estourar o limite
 */
function distribuir({ alturas, margens, gap, disponivel, alturaSecao, temSecoes }) {
  const paginas = [];
  let atual = [];
  let usado = 0;

  const limite = (primeiraPagina) =>
    disponivel - (primeiraPagina || !temSecoes ? 0 : alturaSecao);

  for (let i = 0; i < alturas.length; i += 1) {
    const vazia = atual.length === 0;
    const custo = alturas[i] + (vazia ? 0 : gap + margens[i]);
    const cabe = usado + custo <= limite(paginas.length === 0);

    if (!vazia && !cabe) {
      paginas.push(atual);
      if (paginas.length > MAX_PAGINAS) return null;
      // O item sozinho precisa caber na página nova, senão não há solução.
      if (alturas[i] > limite(false)) return null;
      atual = [i];
      usado = alturas[i];
    } else {
      if (vazia && custo > limite(paginas.length === 0)) return null; // item maior que a página
      atual.push(i);
      usado += custo;
    }
  }
  if (atual.length) paginas.push(atual);
  return paginas.length ? paginas : [[]];
}

/** Move um título de seção que ficou sozinho no fim da página para a próxima. */
function corrigirOrfaos(paginas, itens) {
  for (let p = 0; p < paginas.length - 1; p += 1) {
    const pagina = paginas[p];
    while (pagina.length > 1 && itens[pagina[pagina.length - 1]].tipo === 'secao') {
      paginas[p + 1].unshift(pagina.pop());
    }
  }
  return paginas;
}

/**
 * Reparte a sobra vertical entre as linhas, até um teto.
 * Só usa espaço já contabilizado como livre, então não há risco de estouro.
 */
function folgaExtra(indices, { alturas, margens, gap, disponivel, alturaSecao }, primeira, temSecoes) {
  const reserva = primeira || !temSecoes ? 0 : alturaSecao;
  const ocupado = indices.reduce(
    (soma, idx, k) => soma + alturas[idx] + (k === 0 ? 0 : gap + margens[idx]),
    0,
  );
  const sobra = disponivel - reserva - ocupado;
  const vaos = Math.max(indices.length - 1, 1);
  const extra = Math.max(0, sobra) / vaos;
  return Math.min(extra, gap * 2.5);
}

/**
 * Pagina um catálogo.
 *
 * @param {Object} params
 * @param {Document} params.documento
 * @param {Window} params.janela
 * @param {import('../model/schema.js').Catalogo} params.catalogo
 * @param {Object} [params.opcoes]
 * @returns {{paginas: {html:string, indices:number[]}[], escala:number, colunas:Object, itens:Array}}
 */
export function paginar({ documento, janela, catalogo, opcoes = {} }) {
  const colunas = definirColunas(catalogo, opcoes);
  const itens = montarItens(catalogo, colunas, opcoes);
  const temSecoes = itens.some((i) => i.tipo === 'secao');

  const escalaMin = opcoes.escalaMin ?? ESCALA_MIN;
  const escalaMax = opcoes.escalaMax ?? ESCALA_MAX;
  const base = { documento, janela, catalogo, colunas, itens, opcoes };

  const tentar = (escala) => {
    const m = medir(documento, janela, { ...base, escala });
    const paginas = distribuir({ ...m, disponivel: m.disponivel, temSecoes });
    return { medida: m, paginas: paginas ? corrigirOrfaos(paginas, itens) : null };
  };

  if (!itens.length) {
    return { paginas: [], escala: 1, colunas, itens };
  }

  // Piso: se nem na menor escala couber em N páginas, N é inviável.
  const noMinimo = tentar(escalaMin);
  if (!noMinimo.paginas) {
    throw new Error('Conteúdo não cabe nem na menor escala — revise a lista.');
  }

  // Busca o menor N viável e, dentro dele, a maior escala.
  let melhor = null;
  for (let n = noMinimo.paginas.length; n <= MAX_PAGINAS; n += 1) {
    let lo = escalaMin;
    let hi = escalaMax;
    let achou = null;

    // A escala mínima já cabe em `n`? (garantido para o primeiro n testado)
    const piso = tentar(lo);
    if (!piso.paginas || piso.paginas.length > n) continue;
    achou = { escala: lo, ...piso };

    for (let passo = 0; passo < 11; passo += 1) {
      const meio = (lo + hi) / 2;
      const r = tentar(meio);
      if (r.paginas && r.paginas.length <= n) {
        achou = { escala: meio, ...r };
        lo = meio;
      } else {
        hi = meio;
      }
    }
    melhor = achou;
    break;
  }

  if (!melhor) throw new Error('Não foi possível paginar o catálogo.');

  const { escala, medida, paginas } = melhor;
  const total = paginas.length;

  const html = paginas.map((indices, i) => {
    const extra = folgaExtra(indices, medida, i === 0, temSecoes);
    const blocos = indices.map((idx, k) => {
      const item = itens[idx];
      // Faixa de continuação quando a página começa no meio de uma seção.
      if (k === 0 && i > 0 && item.tipo === 'produto' && item.secao) {
        return htmlSecao(item.secao, true) + item.html;
      }
      return item.html;
    });

    return {
      indices,
      html: htmlPagina({
        catalogo,
        colunas,
        blocos,
        numero: i + 1,
        total,
        escala,
        opcoes,
      }).replace(
        '<div class="corpo">',
        `<div class="corpo" style="gap:${(medida.gap + extra).toFixed(2)}px">`,
      ),
    };
  });

  return { paginas: html, escala, colunas, itens };
}

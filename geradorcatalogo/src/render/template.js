/**
 * Montagem do HTML do catálogo.
 *
 * A saída é sempre uma lista de páginas 9:16. Quem decide *quantas* páginas e
 * com que escala é `../layout/paginate.js` — aqui só desenhamos o que mandaram.
 */

import { formatarValor } from '../parser/precos.js';
import { varsCss, obterTema } from '../themes/temas.js';
import { removerTermos } from './limpeza.js';

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

/**
 * Margens da página, em px do projeto (base 1080x1920).
 *
 * `stories` reserva a área que Instagram e WhatsApp cobrem com a própria
 * interface: foto de perfil e nome no topo, campo de resposta embaixo. Sai
 * caro em espaço — ~30% da altura — mas é a diferença entre o catálogo ser
 * lido e sair cortado.
 */
export const MARGENS = {
  padrao: { topo: 56, lateral: 56, base: 56 },
  stories: { topo: 250, lateral: 72, base: 320 },
};

/** Resolve as margens a partir do preset e das sobrescritas pontuais. */
export function normalizarMargens(margens = {}) {
  const base = MARGENS[margens.preset] ?? MARGENS.padrao;
  const limitar = (v, padrao) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 && n <= 600 ? n : padrao;
  };
  return {
    topo: limitar(margens.topo, base.topo),
    lateral: limitar(margens.lateral, base.lateral),
    base: limitar(margens.base, base.base),
  };
}

/** Alinhamentos aceitos por coluna, e o padrão de cada uma. */
export const ALINHAMENTOS = ['esquerda', 'centro', 'direita'];
export const ALINHAMENTO_PADRAO = { nome: 'esquerda', cor: 'centro', preco: 'centro' };

/** Descarta valor inválido em vez de gerar um atributo que o CSS ignora calado. */
export function normalizarAlinhamento(alinhar = {}) {
  const saida = { ...ALINHAMENTO_PADRAO };
  for (const coluna of Object.keys(ALINHAMENTO_PADRAO)) {
    const valor = alinhar[coluna];
    if (valor && ALINHAMENTOS.includes(valor)) saida[coluna] = valor;
  }
  return saida;
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

/**
 * Layouts disponíveis para o corpo do catálogo.
 *
 * `tabela` é o original: uma linha por produto, largura inteira. Os outros três
 * põem dois produtos por linha, o que só compensa quando o nome é curto — numa
 * lista de TVs, com nome de 86 caracteres na mediana, metade da largura faz o
 * texto quebrar em cinco linhas e a página render menos, não mais.
 */
export const LAYOUTS = ['tabela', 'grade', 'vitrine', 'duplo'];
export const LAYOUT_PADRAO = 'tabela';

/** O layout põe dois produtos lado a lado? */
export function ehDuasColunas(layout) {
  return layout === 'grade' || layout === 'vitrine' || layout === 'duplo';
}

export function normalizarLayout(layout) {
  return LAYOUTS.includes(layout) ? layout : LAYOUT_PADRAO;
}

/**
 * As partes de um produto, já limpas e formatadas.
 * Os quatro layouts montam a mesma informação em arranjos diferentes.
 */
function pecasDoProduto(produto, colunas, opcoes) {
  // Por padrão o catálogo reproduz a palavra como ela veio na lista
  // ("LANÇAMENTO - Redmi 15C"). O selo destacado é opt-in, via `opcoes.selo`,
  // porque inventar um rótulo que o autor não escreveu é decisão dele, não do
  // código. Para sumir de vez existe `--remover`.
  const marcadorBruto = produto.marcador || (produto.lancamento ? 'LANÇAMENTO' : '');
  // `--remover` também alcança o marcador: quem pede para tirar "LANÇAMENTO"
  // quer que ele suma da linha, não só do nome. Aqui vazio significa some —
  // ao contrário do nome, que volta ao original para a linha não ficar anônima.
  const marcador = removerTermos(marcadorBruto, opcoes.remover);
  const selo = !marcador
    ? ''
    : opcoes.selo
      ? `<span class="linha__selo">${escapar(opcoes.selo)}</span>`
      : `<span class="linha__marcador">${escapar(marcador)}</span> `;

  const obs = produto.observacao
    ? `<span class="linha__obs">${escapar(produto.observacao)}</span>`
    : '';

  // A remoção é aplicada no desenho, não na leitura: o modelo segue com o
  // nome completo, e trocar a lista de palavras não exige reprocessar a lista.
  const nome = removerTermos(produto.nome, opcoes.remover) || produto.nome;

  // Produto com um preço só (fone, carregador) repete o valor nas duas colunas
  // em vez de deixar uma delas com um traço. O parcelamento não vai junto:
  // "3x 33,00" embaixo de "Dinheiro / Pix" diz uma coisa que não existe.
  const unico = produto.avista ?? produto.parcelado;
  const semParcelas = unico ? { ...unico, parcelas: null, valorParcela: null } : null;

  // A sublinha "10x 76,00" só aparece quando o produto foge do parcelamento
  // dominante — para o resto, o cabeçalho da coluna já diz "em até 10x".
  // Repetir em todas as linhas custa ~11px cada, o que numa lista de 42
  // produtos é a diferença entre uma página e duas.
  const parcelas = produto.parcelado?.parcelas ?? null;
  const mostrarParcela =
    opcoes.mostrarParcela ?? (parcelas !== null && parcelas !== colunas.parcelasDominante);

  return {
    selo,
    obs,
    nome,
    cores: produto.cores.join(' / '),
    precoDe: (tipo) => produto[tipo] ?? (tipo === 'avista' ? semParcelas : unico),
    mostrarParcela,
  };
}

/** Cartão: nome em cima, cor, e os dois preços lado a lado embaixo. */
function htmlCartao(produto, colunas, opcoes, pecas) {
  const cor = pecas.cores
    ? `<div class="cartao__cor">${escapar(pecas.cores)}</div>`
    : '';

  const rotulos = { parcelado: rotuloParcelado(colunas).titulo, avista: 'Dinheiro / Pix' };
  const precos = colunas.precos
    .map((tipo) => {
      const preco = pecas.precoDe(tipo);
      if (!preco) return '';
      return `<div class="cartao__preco cartao__preco--${tipo}">
        <span class="cartao__rotulo">${escapar(rotulos[tipo])}</span>
        ${escapar(formatarValor(preco.valor))}
      </div>`;
    })
    .join('');

  return `<div class="cartao">
    <div class="cartao__nome">${pecas.selo}${escapar(pecas.nome)}${pecas.obs}</div>
    ${cor}
    <div class="cartao__precos">${precos}</div>
  </div>`;
}

/** Vitrine: o preço à vista vira o herói, e o parcelado desce para nota. */
function htmlVitrine(produto, colunas, opcoes, pecas) {
  const cor = pecas.cores
    ? `<div class="cartao__cor">${escapar(pecas.cores)}</div>`
    : '';

  const heroi = pecas.precoDe('avista') ?? pecas.precoDe('parcelado');
  const outro = pecas.precoDe('parcelado');
  const n = colunas.parcelasDominante;
  const nota =
    outro && heroi && outro.valor !== heroi.valor
      ? `<div class="cartao__nota">ou ${escapar(formatarValor(outro.valor))} em ${
          outro.parcelas ?? n ?? 10
        }x</div>`
      : '';

  return `<div class="cartao cartao--vitrine">
    <div class="cartao__nome">${pecas.selo}${escapar(pecas.nome)}${pecas.obs}</div>
    ${cor}
    <div class="cartao__heroi">
      ${heroi ? escapar(formatarValor(heroi.valor)) : '—'}
      <span class="cartao__rotulo">à vista</span>
    </div>
    ${nota}
  </div>`;
}

/** HTML de uma linha de produto, no layout pedido. */
export function htmlProduto(produto, colunas, opcoes = {}) {
  // Por padrão o catálogo reproduz a palavra como ela veio na lista
  // ("LANÇAMENTO - Redmi 15C"). O selo destacado é opt-in, via `opcoes.selo`,
  // porque inventar um rótulo que o autor não escreveu é decisão dele, não do
  // código. Para sumir de vez existe `--remover`.
  const layout = normalizarLayout(opcoes.layout);
  const pecas = pecasDoProduto(produto, colunas, opcoes);

  if (layout === 'grade') return htmlCartao(produto, colunas, opcoes, pecas);
  if (layout === 'vitrine') return htmlVitrine(produto, colunas, opcoes, pecas);

  // `tabela` e `duplo` compartilham o desenho da linha; o que muda é a largura,
  // e disso o CSS cuida pelo data-layout da página.
  const nome = `<div class="linha__nome">${pecas.selo}${escapar(pecas.nome)}${pecas.obs}</div>`;
  const cor = colunas.mostrarCor
    ? pecas.cores
      ? `<div class="linha__cor">${escapar(pecas.cores)}</div>`
      : `<div class="linha__cor linha__cor--vazio"></div>`
    : '';
  const precos = colunas.precos
    .map((tipo) => htmlPreco(pecas.precoDe(tipo), tipo, pecas.mostrarParcela))
    .join('');

  return `<div class="linha grade">${nome}${cor}${precos}</div>`;
}

/** Envolve dois produtos numa linha só, para a paginação medir o par junto. */
export function htmlPar(a, b = '') {
  return `<div class="par">${a}${b || '<div class="par__vazio"></div>'}</div>`;
}

/** HTML de um título de seção. */
export function htmlSecao(titulo, continuacao = false) {
  const cont = continuacao ? `<span class="secao__cont">(continuação)</span>` : '';
  return `<div class="secao">${escapar(titulo)}${cont}</div>`;
}

/** Cabeçalho da página. */
export function htmlCabecalho(catalogo, opcoes = {}) {
  // Cada linha do cabeçalho é substituível e some quando fica vazia. O que vem
  // da lista é ponto de partida, não imposição.
  const titulo = (opcoes.titulo ?? catalogo.titulo ?? '').trim();
  const sobretitulo = (opcoes.sobretitulo ?? 'Lista de produtos').trim();
  const dataTexto = opcoes.mostrarData === false ? '' : (opcoes.data ?? catalogo.data ?? '').trim();
  const subtituloTexto =
    opcoes.mostrarSubtitulo === false ? '' : (opcoes.subtitulo ?? catalogo.subtitulo ?? '').trim();

  const partes = [
    sobretitulo ? `<div class="cabecalho__sobretitulo">${escapar(sobretitulo)}</div>` : '',
    titulo ? `<h1 class="cabecalho__titulo">${escapar(titulo)}</h1>` : '',
    dataTexto ? `<div class="cabecalho__data">${escapar(dataTexto)}</div>` : '',
    subtituloTexto ? `<div class="cabecalho__subtitulo">${escapar(subtituloTexto)}</div>` : '',
  ].filter(Boolean);

  // Cabeçalho totalmente vazio não deve reservar espaço nenhum.
  if (!partes.length) return '<header class="cabecalho cabecalho--vazio"></header>';
  return `<header class="cabecalho">${partes.join('')}</header>`;
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
  const margens = normalizarMargens(opcoes.margens);
  const estilo = [
    varsCss(opcoes.tema, opcoes.varsExtras),
    `--escala:${escala}`,
    // O cabeçalho encolhe bem menos que a tabela: numa lista longa a tabela
    // fica compacta, mas o título continua sendo a chamada do story.
    `--escala-cabecalho:${escalaCabecalho(escala).toFixed(4)}`,
    opcoes.fundo ? `--fundo:${opcoes.fundo}` : '',
    opcoes.veu ? `--foto-veu:${opcoes.veu}` : '',
    `--margem-topo:${margens.topo}px`,
    `--margem-lateral:${margens.lateral}px`,
    `--margem-base:${margens.base}px`,
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

  const alinhar = normalizarAlinhamento(opcoes.alinhar);
  // O tratamento do título vem do tema. Seletor CSS não lê custom property,
  // por isso viaja como atributo.
  const cabecalho = obterTema(opcoes.tema).cabecalho ?? 'simples';

  return `<article class="pagina" style="${estilo}"
    data-cores="${colunas.mostrarCor ? 'sim' : 'nao'}"
    data-precos="${colunas.precos.length}"
    data-alinha-nome="${alinhar.nome}"
    data-alinha-cor="${alinhar.cor}"
    data-alinha-preco="${alinhar.preco}"
    data-layout="${normalizarLayout(opcoes.layout)}"
    data-cabecalho="${cabecalho}"
    data-pagina="${numero}">
    ${foto}
    <div class="pagina__brilho"></div>
    ${htmlCabecalho(catalogo, opcoes)}
    ${['grade', 'vitrine'].includes(normalizarLayout(opcoes.layout))
      ? '' // O cartão traz o rótulo do preço dentro de si.
      : htmlRotulos(catalogo, colunas)}
    <div class="corpo">${blocos.join('')}</div>
    ${htmlRodape(opcoes, numero, total)}
  </article>`;
}

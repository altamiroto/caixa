/**
 * Modelo canônico do catálogo.
 *
 * Tudo que o parser produz e tudo que o render consome passa por aqui. Se um
 * formato novo de lista aparecer, o trabalho é ensinar o parser a preencher
 * este modelo — o render não muda.
 *
 * @typedef {Object} Preco
 * @property {number} valor        Valor total em reais (ex.: 1330)
 * @property {number|null} parcelas    Nº de parcelas, quando parcelado
 * @property {number|null} valorParcela Valor de cada parcela, quando informado
 * @property {'avista'|'parcelado'} tipo
 * @property {string} rotulo       Rótulo original ("Dinheiro/pix", "10x Cartão")
 * @property {string} bruto        Linha original, para auditoria
 *
 * @typedef {Object} Produto
 * @property {string} nome         Nome limpo, sem emoji/markup/preço
 * @property {string[]} cores      ["Preto", "Azul"]
 * @property {string} observacao   "(Bateria 92%, Todo Original)" -> "Bateria 92%, Todo Original"
 * @property {boolean} lancamento  true quando a linha trazia "LANÇAMENTO"
 * @property {string} emoji        Emoji que prefixava a linha
 * @property {Preco|null} avista
 * @property {Preco|null} parcelado
 * @property {string[]} bruto      Linhas originais do bloco
 * @property {Aviso[]} avisos
 *
 * @typedef {Object} Secao
 * @property {string} titulo       "REALME", "PREMIUMS/SEMI-NOVOS"
 * @property {string} emoji
 * @property {Produto[]} produtos
 *
 * @typedef {Object} Aviso
 * @property {'info'|'atencao'|'erro'} nivel
 * @property {string} codigo
 * @property {string} mensagem
 * @property {number|null} linha   Nº da linha na entrada original
 *
 * @typedef {Object} Catalogo
 * @property {string} titulo       "SMARTPHONES DISPONÍVEIS"
 * @property {string} subtitulo    Linha de citação (">"), quando houver
 * @property {string} data         "07/08/26" como veio no cabeçalho
 * @property {string} emoji
 * @property {Secao[]} secoes
 * @property {Aviso[]} avisos
 * @property {ResumoCatalogo} resumo
 *
 * @typedef {Object} ResumoCatalogo
 * @property {number} totalProdutos
 * @property {boolean} temCores        Alguma linha declarou cor
 * @property {boolean} temObservacao   Alguma linha tem observação
 * @property {boolean} temAvista
 * @property {boolean} temParcelado
 */

export function criarAviso(nivel, codigo, mensagem, linha = null) {
  return { nivel, codigo, mensagem, linha };
}

export function catalogoVazio() {
  return {
    titulo: '',
    subtitulo: '',
    data: '',
    emoji: '',
    secoes: [],
    avisos: [],
    resumo: {
      totalProdutos: 0,
      temCores: false,
      temObservacao: false,
      temAvista: false,
      temParcelado: false,
    },
  };
}

/** Percorre todos os produtos do catálogo, independente de seção. */
export function* iterarProdutos(catalogo) {
  for (const secao of catalogo.secoes) {
    for (const produto of secao.produtos) yield produto;
  }
}

/**
 * Recalcula `resumo` a partir das seções. O render usa isso para decidir
 * quais colunas existem — sem coluna vazia, sem coluna faltando.
 */
export function recalcularResumo(catalogo) {
  const r = {
    totalProdutos: 0,
    temCores: false,
    temObservacao: false,
    temAvista: false,
    temParcelado: false,
  };
  for (const p of iterarProdutos(catalogo)) {
    r.totalProdutos += 1;
    if (p.cores.length) r.temCores = true;
    if (p.observacao) r.temObservacao = true;
    if (p.avista) r.temAvista = true;
    if (p.parcelado) r.temParcelado = true;
  }
  catalogo.resumo = r;
  return catalogo;
}

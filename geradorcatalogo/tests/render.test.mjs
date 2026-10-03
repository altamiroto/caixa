/**
 * Testes das opções de apresentação: remoção de palavras, alinhamento por
 * coluna e margens da página.
 *
 * São opções que o usuário escolhe na hora, então erram silenciosamente: um
 * alinhamento inválido viraria o padrão sem avisar, uma margem fora de faixa
 * empurraria o conteúdo para fora da imagem.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { removerTermos, listaDeTermos } from '../src/render/limpeza.js';
import {
  normalizarAlinhamento,
  normalizarMargens,
  MARGENS,
  ALINHAMENTO_PADRAO,
  htmlPagina,
  htmlProduto,
  htmlCabecalho,
  htmlPar,
  definirColunas,
  ehDuasColunas,
  htmlRotulos,
  normalizarMosaico,
  MOSAICO_PADRAO,
  normalizarLayout,
} from '../src/render/template.js';

const catalogoFalso = {
  titulo: 'Teste',
  subtitulo: '',
  data: '07/08/26',
  emoji: '',
  secoes: [],
  avisos: [],
  resumo: { totalProdutos: 0, temCores: true, temObservacao: false, temAvista: true, temParcelado: true },
};

test('listaDeTermos aceita vírgula, quebra de linha e array', () => {
  assert.deepEqual(listaDeTermos('Smart TV, LANÇAMENTO'), ['Smart TV', 'LANÇAMENTO']);
  assert.deepEqual(listaDeTermos('a\nb'), ['a', 'b']);
  assert.deepEqual(listaDeTermos([' x ', '', 'y']), ['x', 'y']);
  assert.deepEqual(listaDeTermos(''), []);
  assert.deepEqual(listaDeTermos(undefined), []);
});

test('removerTermos ignora acento e caixa', () => {
  assert.equal(removerTermos('LANÇAMENTO - Redmi 15C', 'lancamento'), 'Redmi 15C');
  assert.equal(removerTermos('Lançamento Redmi', 'LANÇAMENTO'), 'Redmi');
  assert.equal(removerTermos('Relógio Xiaomi', 'relogio'), 'Xiaomi');
});

test('removerTermos casa palavra inteira, não pedaço', () => {
  // "TV" não pode comer o "TV" de dentro de "TVS" nem de "Smart".
  assert.equal(removerTermos('TVS e TV Box', 'TV'), 'TVS e Box');
  assert.equal(removerTermos('Notebook', 'note'), 'Notebook');
});

test('removerTermos aceita frase e tolera espaçamento', () => {
  assert.equal(
    removerTermos('Smart TV 32" Philco Roku TV', 'Smart TV'),
    '32" Philco Roku TV',
  );
  assert.equal(removerTermos('Smart   TV 40"', 'Smart TV'), '40"');
});

test('removerTermos costura o que sobra', () => {
  assert.equal(removerTermos('Tomada/Carregador Turbo 45w', 'Tomada/Carregador'), 'Turbo 45w');
  assert.equal(removerTermos('Fone Bluetooth M10', 'Fone Bluetooth'), 'M10');
  // Não sobra separador solto nem espaço duplo.
  assert.equal(removerTermos('A - LANÇAMENTO - B', 'LANÇAMENTO'), 'A - B');
  assert.equal(removerTermos('X (LANÇAMENTO) Y', 'LANÇAMENTO'), 'X Y');
});

test('removerTermos não estraga o nome quando nada casa', () => {
  const nome = 'Xiaomi POCO X7 PRO 5G 8/256GB';
  assert.equal(removerTermos(nome, 'Samsung'), nome);
  assert.equal(removerTermos(nome, ''), nome);
});

test('removerTermos com vários termos e ocorrências repetidas', () => {
  assert.equal(
    removerTermos('Smart TV Samsung Smart TV 43"', 'Smart TV'),
    'Samsung 43"',
  );
  assert.equal(removerTermos('Fone Bluetooth Xiaomi Buds', 'Fone,Bluetooth'), 'Xiaomi Buds');
});

test('normalizarAlinhamento recusa valor inválido em vez de aceitar calado', () => {
  assert.deepEqual(normalizarAlinhamento({}), ALINHAMENTO_PADRAO);
  assert.deepEqual(normalizarAlinhamento(), ALINHAMENTO_PADRAO);
  assert.equal(normalizarAlinhamento({ nome: 'direita' }).nome, 'direita');
  assert.equal(normalizarAlinhamento({ nome: 'meio' }).nome, ALINHAMENTO_PADRAO.nome);
  assert.equal(normalizarAlinhamento({ preco: 'esquerda' }).preco, 'esquerda');
});

test('normalizarMargens aplica preset, sobrescrita e limite', () => {
  assert.deepEqual(normalizarMargens(), MARGENS.padrao);
  assert.deepEqual(normalizarMargens({ preset: 'stories' }), MARGENS.stories);

  // Sobrescrita pontual sobre o preset.
  const m = normalizarMargens({ preset: 'stories', lateral: 100 });
  assert.equal(m.lateral, 100);
  assert.equal(m.topo, MARGENS.stories.topo);

  // Valor absurdo ou inválido cai no do preset.
  assert.equal(normalizarMargens({ topo: 9999 }).topo, MARGENS.padrao.topo);
  assert.equal(normalizarMargens({ topo: -10 }).topo, MARGENS.padrao.topo);
  assert.equal(normalizarMargens({ topo: 'abc' }).topo, MARGENS.padrao.topo);
  assert.equal(normalizarMargens({ topo: 0 }).topo, 0);
});

test('a margem de stories reserva bem mais que o padrão', () => {
  const gasto = (m) => m.topo + m.base;
  assert.ok(
    gasto(MARGENS.stories) > gasto(MARGENS.padrao) * 4,
    'o preset de stories precisa reservar a faixa da interface do app',
  );
});

test('htmlPagina publica alinhamento e margens no HTML', () => {
  const colunas = definirColunas(catalogoFalso);
  const html = htmlPagina({
    catalogo: catalogoFalso,
    colunas,
    blocos: [],
    numero: 1,
    total: 1,
    escala: 1,
    opcoes: { alinhar: { nome: 'direita' }, margens: { preset: 'stories' } },
  });

  assert.match(html, /data-alinha-nome="direita"/);
  assert.match(html, /data-alinha-cor="centro"/);
  assert.match(html, new RegExp(`--margem-topo:${MARGENS.stories.topo}px`));
  assert.match(html, new RegExp(`--margem-base:${MARGENS.stories.base}px`));
});

test('htmlProduto aplica a remoção sem tocar no modelo', () => {
  const produto = {
    nome: 'Smart TV 32" Philco',
    cores: [],
    observacao: '',
    lancamento: false,
    emoji: '',
    avista: { valor: 885, tipo: 'avista', parcelas: null, valorParcela: null, rotulo: '', bruto: '' },
    parcelado: null,
    bruto: [],
    avisos: [],
  };
  const colunas = definirColunas(catalogoFalso);

  const html = htmlProduto(produto, colunas, { remover: 'Smart TV' });
  assert.match(html, /32&quot; Philco/, 'o nome escapado tem que sobreviver à remoção');
  assert.doesNotMatch(html, /Smart TV/);

  // O modelo continua íntegro: a remoção é só de apresentação.
  assert.equal(produto.nome, 'Smart TV 32" Philco');
});

test('o preço repetido na coluna Dinheiro não leva o parcelamento junto', () => {
  const produto = {
    nome: 'Fone Bluetooth M10',
    cores: [],
    observacao: '',
    lancamento: false,
    emoji: '',
    avista: null,
    parcelado: {
      valor: 34.99,
      tipo: 'parcelado',
      parcelas: 3,
      valorParcela: 11.66,
      rotulo: 'cartão',
      bruto: '',
    },
    bruto: [],
    avisos: [],
  };
  const colunas = definirColunas(catalogoFalso);

  /*
   * Só existe preço de cartão, então ele é repetido do lado do dinheiro em vez
   * de deixar um traço. Mas "3x 11,66" embaixo de "Dinheiro / Pix" anuncia um
   * parcelamento que não existe — a sublinha fica só na coluna do cartão.
   */
  const html = htmlProduto(produto, colunas, { mostrarParcela: true });
  const avista = html.match(/linha__preco--avista[^>]*>(.*?)<\/div>/s)?.[1] ?? '';
  const parcelado = html.match(/linha__preco--parcelado[^>]*>(.*?)<\/div>/s)?.[1] ?? '';

  assert.match(parcelado, /3x 11,66/, 'a coluna do cartão perdeu a parcela');
  assert.match(avista, /34,99/);
  assert.doesNotMatch(avista, /3x/, 'parcelamento anunciado na coluna do dinheiro');
});

test('remover tudo do nome não deixa a linha sem identificação', () => {
  const produto = {
    nome: 'Smart TV',
    cores: [],
    observacao: '',
    lancamento: false,
    emoji: '',
    avista: { valor: 10, tipo: 'avista', parcelas: null, valorParcela: null, rotulo: '', bruto: '' },
    parcelado: null,
    bruto: [],
    avisos: [],
  };
  const html = htmlProduto(produto, definirColunas(catalogoFalso), { remover: 'Smart TV' });
  assert.match(html, /Smart TV/, 'sobrando vazio, o nome original tem que voltar');
});

// ---------------------------------------------------------------- cabeçalho e selo

const produtoLancamento = () => ({
  nome: 'Redmi 15C 4/128GB',
  cores: [],
  observacao: '',
  lancamento: true,
  marcador: 'LANÇAMENTO',
  emoji: '',
  avista: { valor: 830, tipo: 'avista', parcelas: null, valorParcela: null, rotulo: '', bruto: '' },
  parcelado: null,
  bruto: [],
  avisos: [],
});

test('por padrão o marcador sai como o autor escreveu', () => {
  const html = htmlProduto(produtoLancamento(), definirColunas(catalogoFalso), {});
  assert.match(html, /LANÇAMENTO/);
  assert.doesNotMatch(html, /NOVO/, 'o código não pode inventar um rótulo');
  assert.doesNotMatch(html, /linha__selo/, 'sem --selo não existe cápsula');
});

test('--selo troca o marcador por uma cápsula com o texto pedido', () => {
  const html = htmlProduto(produtoLancamento(), definirColunas(catalogoFalso), { selo: 'NOVO' });
  assert.match(html, /<span class="linha__selo">NOVO<\/span>/);
  assert.doesNotMatch(html, /LANÇAMENTO/);
});

test('produto sem marcador não ganha nada', () => {
  const p = { ...produtoLancamento(), lancamento: false, marcador: '' };
  const html = htmlProduto(p, definirColunas(catalogoFalso), { selo: 'NOVO' });
  assert.doesNotMatch(html, /linha__selo|linha__marcador/);
});

test('o marcador pode ser removido junto com as outras palavras', () => {
  const html = htmlProduto(produtoLancamento(), definirColunas(catalogoFalso), {
    remover: 'LANÇAMENTO',
  });
  assert.doesNotMatch(html, /LANÇAMENTO/);
  assert.match(html, /Redmi 15C/);
});

test('título e data do cabeçalho podem ser substituídos', () => {
  const semOpcoes = htmlCabecalho(catalogoFalso, {});
  assert.match(semOpcoes, /Teste/);
  assert.match(semOpcoes, /07\/08\/26/);

  const trocado = htmlCabecalho(catalogoFalso, { titulo: 'CELULARES', data: 'HOJE' });
  assert.match(trocado, /CELULARES/);
  assert.match(trocado, /HOJE/);
  assert.doesNotMatch(trocado, /Teste/);
  assert.doesNotMatch(trocado, /07\/08\/26/);
});

test('cada linha do cabeçalho pode ser escondida', () => {
  const semData = htmlCabecalho(catalogoFalso, { mostrarData: false });
  assert.doesNotMatch(semData, /cabecalho__data/);
  assert.match(semData, /Teste/, 'esconder a data não pode levar o título junto');

  const semSobretitulo = htmlCabecalho(catalogoFalso, { sobretitulo: '' });
  assert.doesNotMatch(semSobretitulo, /cabecalho__sobretitulo/);

  const comSubtitulo = { ...catalogoFalso, subtitulo: 'Samsung, Xiaomi' };
  assert.match(htmlCabecalho(comSubtitulo, {}), /Samsung, Xiaomi/);
  assert.doesNotMatch(htmlCabecalho(comSubtitulo, { mostrarSubtitulo: false }), /Samsung, Xiaomi/);
});

test('cabeçalho totalmente vazio não reserva espaço', () => {
  const html = htmlCabecalho(catalogoFalso, {
    titulo: '',
    sobretitulo: '',
    mostrarData: false,
    mostrarSubtitulo: false,
  });
  assert.match(html, /cabecalho--vazio/);
  assert.doesNotMatch(html, /cabecalho__/);
});

// ------------------------------------------------------------------ layouts

test('cada layout desenha um arranjo diferente da mesma informação', () => {
  const colunas = definirColunas(catalogoFalso);
  const p = produtoLancamento();

  const tabela = htmlProduto(p, colunas, { layout: 'tabela' });
  assert.match(tabela, /class="linha grade"/);
  assert.doesNotMatch(tabela, /cartao/);

  const grade = htmlProduto(p, colunas, { layout: 'grade' });
  assert.match(grade, /class="cartao"/);
  assert.match(grade, /cartao__precos/);

  const vitrine = htmlProduto(p, colunas, { layout: 'vitrine' });
  assert.match(vitrine, /cartao--vitrine/);
  assert.match(vitrine, /cartao__heroi/);

  // `duplo` reaproveita o desenho da linha; quem muda a largura é o CSS.
  assert.equal(htmlProduto(p, colunas, { layout: 'duplo' }), tabela);

  // Layout inexistente cai no padrão em vez de gerar HTML vazio.
  assert.equal(htmlProduto(p, colunas, { layout: 'inventado' }), tabela);

  // O nome e o preço sobrevivem em todos.
  for (const html of [tabela, grade, vitrine]) {
    assert.match(html, /Redmi 15C/);
    assert.match(html, /830/);
  }
});

test('ehDuasColunas separa os layouts pareados dos de largura inteira', () => {
  assert.equal(ehDuasColunas('tabela'), false);
  for (const l of ['grade', 'vitrine', 'duplo']) {
    assert.ok(ehDuasColunas(l), `${l} deveria ser de duas colunas`);
  }
  assert.equal(normalizarLayout('nada'), 'tabela');
  assert.equal(normalizarLayout(undefined), 'tabela');
});

test('nos cartões o rótulo do preço vai dentro, já que não há faixa de colunas', () => {
  const colunas = definirColunas(catalogoFalso);
  const grade = htmlProduto(produtoLancamento(), colunas, { layout: 'grade' });
  assert.match(grade, /cartao__rotulo/);
  assert.match(grade, /Dinheiro \/ Pix/);

  const pagina = htmlPagina({
    catalogo: catalogoFalso,
    colunas,
    blocos: [],
    numero: 1,
    total: 1,
    escala: 1,
    opcoes: { layout: 'grade' },
  });
  assert.match(pagina, /data-layout="grade"/);
  assert.doesNotMatch(pagina, /class="rotulos/, 'a faixa de colunas não cabe no layout de cartão');
});

test('htmlPar preenche a vaga que sobra em vez de esticar o solitário', () => {
  assert.match(htmlPar('<i>a</i>', '<i>b</i>'), /<div class="par"><i>a<\/i><i>b<\/i><\/div>/);
  assert.match(htmlPar('<i>a</i>'), /par__vazio/);
});

test('coluna de preço sem forma de pagamento escrita se chama "Preço", não "Dinheiro / Pix"', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseVarios } = await import('../src/parser/parse.js');
  const ler = (nome) => parseVarios(readFileSync(new URL(`../samples/${nome}`, import.meta.url), 'utf8'))[0];

  // Atacado: um preço só, sem "dinheiro" nem "cartão" em lugar nenhum.
  const atacado = ler('atacado-celulares.txt');
  const faixaAtacado = htmlRotulos(atacado, definirColunas(atacado));
  assert.match(faixaAtacado, />Preço</);
  assert.doesNotMatch(faixaAtacado, /Dinheiro|Cartão/);

  // Varejo: a lista diz "Dinheiro/pix" e tem cartão ao lado.
  const varejo = ler('acessorios-varejo.txt');
  const faixaVarejo = htmlRotulos(varejo, definirColunas(varejo));
  assert.match(faixaVarejo, /Dinheiro<small>\/ Pix<\/small>/);
  assert.match(faixaVarejo, /Cartão/);
});

// ------------------------------------------------------------------ mosaico

test('normalizarMosaico recusa valores fora da faixa em vez de aceitar calado', () => {
  assert.deepEqual(normalizarMosaico(), MOSAICO_PADRAO);
  assert.deepEqual(normalizarMosaico({ colunas: 9, linhas: 0, enfase: 'x', cartao: 'y' }), MOSAICO_PADRAO);
  assert.deepEqual(normalizarMosaico({ colunas: '2', linhas: 5, enfase: 'cartao', cartao: 'parcelas' }), {
    colunas: 2, linhas: 5, enfase: 'cartao', cartao: 'parcelas',
  });
});

test('mosaico: dinheiro em cima, cartão embaixo, e o destaque troca de lado', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseVarios } = await import('../src/parser/parse.js');
  const cat = parseVarios(readFileSync(new URL('../samples/acessorios-varejo.txt', import.meta.url), 'utf8'))[0];
  const colunas = definirColunas(cat);
  const aiwa = cat.secoes[0].produtos.find((p) => p.nome.startsWith('Caixa de Som Boombox Plus AIWA'));

  const padrao = htmlProduto(aiwa, colunas, { layout: 'mosaico' });
  assert.ok(padrao.indexOf('mcard__preco--avista') < padrao.indexOf('mcard__preco--parcelado'), 'dinheiro antes do cartão');
  assert.match(padrao, /mcard__preco--avista mcard__preco--forte/);
  assert.match(padrao, />1\.169</);
  assert.match(padrao, /Cartão · até 10x/);
  assert.match(padrao, />1\.320</);

  const cartaoForte = htmlProduto(aiwa, colunas, { layout: 'mosaico', mosaico: { enfase: 'cartao' } });
  assert.match(cartaoForte, /mcard__preco--parcelado mcard__preco--forte/);
  assert.doesNotMatch(cartaoForte, /mcard__preco--avista mcard__preco--forte/);
  assert.ok(cartaoForte.indexOf('mcard__preco--avista') < cartaoForte.indexOf('mcard__preco--parcelado'), 'a ordem não muda');
});

test('mosaico "parcelas + total": cada produto com o próprio parcelamento', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseVarios } = await import('../src/parser/parse.js');
  const cat = parseVarios(readFileSync(new URL('../samples/acessorios-varejo.txt', import.meta.url), 'utf8'))[0];
  const colunas = definirColunas(cat);
  const achar = (inicio) => cat.secoes[0].produtos.find((p) => p.nome.startsWith(inicio));
  const op = { layout: 'mosaico', mosaico: { cartao: 'parcelas' } };

  const alexa = htmlProduto(achar('Alexa Echo Dot'), colunas, op);
  assert.match(alexa, /6x de 82,99/);
  assert.match(alexa, /<small>total<\/small> 497,94/);

  const geladeira = htmlProduto(achar('Geladeira Electrolux'), colunas, op);
  assert.match(geladeira, /10x de 399,90/);
  assert.match(geladeira, /<small>total<\/small> 3\.999/);

  const kabum = htmlProduto(achar('SmartWatch/Relogio KaBuM'), colunas, op);
  assert.match(kabum, /3x de 30,00/);

  // Só cartão: o bloco do cartão vira o destaque, e não aparece dinheiro inventado.
  assert.match(alexa, /mcard__preco--parcelas mcard__preco--forte/);
  assert.doesNotMatch(alexa, /mcard__preco--avista/);
});

test('mosaico: preço único de atacado aparece uma vez, como "Preço"', async () => {
  const { readFileSync } = await import('node:fs');
  const { parseVarios } = await import('../src/parser/parse.js');
  const cat = parseVarios(readFileSync(new URL('../samples/atacado-celulares.txt', import.meta.url), 'utf8'))[0];
  const html = htmlProduto(cat.secoes[0].produtos[0], definirColunas(cat), { layout: 'mosaico' });
  assert.equal((html.match(/class="mcard__preco /g) || []).length, 1, 'um bloco de preço só');
  assert.match(html, />Preço</);
  assert.match(html, />755</);
  assert.doesNotMatch(html, /Cartão|Dinheiro/);
});

test('justificado vale para o nome, não para cor e preço', () => {
  assert.equal(normalizarAlinhamento({ nome: 'justificado' }).nome, 'justificado');
  assert.equal(normalizarAlinhamento({ preco: 'justificado' }).preco, ALINHAMENTO_PADRAO.preco);
  assert.equal(normalizarAlinhamento({ cor: 'justificado' }).cor, ALINHAMENTO_PADRAO.cor);

  const html = htmlPagina({
    catalogo: catalogoFalso,
    colunas: definirColunas(catalogoFalso),
    blocos: [],
    numero: 1,
    total: 1,
    escala: 1,
    opcoes: { alinhar: { nome: 'justificado' }, layout: 'mosaico' },
  });
  assert.match(html, /data-alinha-nome="justificado"/);
});

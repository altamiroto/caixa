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
  definirColunas,
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parse, parseVarios } from '../src/parser/parse.js';
import { paraNumero, lerPreco, formatarValor } from '../src/parser/precos.js';
import { ehTrechoDeCor } from '../src/parser/cores.js';
import { iterarProdutos } from '../src/model/schema.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const amostra = (nome) => readFileSync(join(raiz, 'samples', nome), 'utf8');

test('paraNumero entende os formatos pt-BR das listas', () => {
  assert.equal(paraNumero('1.020'), 1020);
  assert.equal(paraNumero('1. 330'), 1330);
  assert.equal(paraNumero('99,99'), 99.99);
  assert.equal(paraNumero('1.599,90'), 1599.9);
  assert.equal(paraNumero('2899'), 2899);
  assert.equal(paraNumero('3.960'), 3960);
});

test('lerPreco separa à vista de parcelado', () => {
  const p1 = lerPreco('R$ 760 (10x)');
  assert.equal(p1.tipo, 'parcelado');
  assert.equal(p1.valor, 760);
  assert.equal(p1.parcelas, 10);

  const p2 = lerPreco('R$ 670 (Dinheiro)');
  assert.equal(p2.tipo, 'avista');
  assert.equal(p2.valor, 670);
  assert.equal(p2.parcelas, null);

  const p3 = lerPreco('10 x R$ 99,99 (R$ 999,99)');
  assert.equal(p3.tipo, 'parcelado');
  assert.equal(p3.valorParcela, 99.99);
  assert.equal(p3.valor, 999.99);

  const p4 = lerPreco('10 de R$ 278,00(R$ 2.780)');
  assert.equal(p4.valorParcela, 278);
  assert.equal(p4.valor, 2780);

  const p5 = lerPreco('R$ 149,99 em até 6x no cartão');
  assert.equal(p5.tipo, 'parcelado');
  assert.equal(p5.parcelas, 6);
  assert.equal(p5.valor, 149.99);

  // Parêntese não fechado ("Dinheiro88") não pode virar parcelado.
  const p6 = lerPreco('R$  3.999 (Dinheiro88');
  assert.equal(p6.tipo, 'avista');
  assert.equal(p6.valor, 3999);

  // "N parcelas de" é o mesmo que "Nx" e "N de". Sem reconhecer a forma por
  // extenso, o valor da parcela era lido como preço final.
  const p7 = lerPreco('10 parcelas de R$ 67,69 (R$ 676,90)');
  assert.equal(p7.tipo, 'parcelado');
  assert.equal(p7.parcelas, 10);
  assert.equal(p7.valorParcela, 67.69);
  assert.equal(p7.valor, 676.9);

  // Sem o total escrito, ele sai da multiplicação.
  const p8 = lerPreco('6 parcelas de R$ 82,99');
  assert.equal(p8.parcelas, 6);
  assert.equal(p8.valor, 497.94);
});

test('preço com palavra escrita ganha do preço solto', () => {
  const catalogo = parseVarios(
    [
      '*LISTA (05/09/26)*',
      '',
      "🔈 *`Caixa de Som Mifa A90`* - Preta - R$ 345",
      'R$ 420 (6x Cartão)',
      'R$ 385 (Dinheiro/pix)',
    ].join('\n'),
  )[0];
  const produto = catalogo.secoes[0].produtos[0];

  /*
   * A linha diz "345" solto no fim do nome e "385 (Dinheiro/pix)" duas linhas
   * abaixo. Os dois viram preço à vista; vale o que traz a palavra escrita.
   */
  assert.equal(produto.avista.valor, 385);
  assert.equal(produto.parcelado.valor, 420);
});

test('o "6 parcelas de" não fica pendurado no nome do produto', () => {
  const catalogo = parseVarios(
    [
      '*LISTA (05/09/26)*',
      '',
      '🤖 *`Alexa Echo Dot com acesso Alexa+`* - Preta - 6 parcelas de R$ 82,99 (R$ 497,94)',
    ].join('\n'),
  )[0];
  const produto = catalogo.secoes[0].produtos[0];

  assert.equal(produto.nome, 'Alexa Echo Dot com acesso Alexa+');
  assert.deepEqual(produto.cores, ['Preta']);
  assert.equal(produto.parcelado.valor, 497.94);
  assert.equal(produto.parcelado.valorParcela, 82.99);
});

test('ehTrechoDeCor aceita cor e rejeita especificação', () => {
  assert.ok(ehTrechoDeCor('Preto'));
  assert.ok(ehTrechoDeCor('Preto/Azul/Verde'));
  assert.ok(ehTrechoDeCor('Storm Titanium'));
  assert.ok(ehTrechoDeCor('Azul Claro'));
  assert.equal(ehTrechoDeCor('180w RMS Bluetooth'), false);
  assert.equal(ehTrechoDeCor('30ml'), false);
  assert.equal(ehTrechoDeCor('Tela 11 pol. 4G'), false);
});

test('lista de smartphones: seções, produtos e preços', () => {
  const cat = parse(amostra('smartphones.txt'));

  assert.match(cat.titulo, /SMARTPHONES/i);
  assert.equal(cat.data, '07/08/26');
  assert.deepEqual(
    cat.secoes.map((s) => s.titulo),
    ['REALME', 'SAMSUNG', 'XIAOMI'],
  );
  assert.equal(cat.resumo.totalProdutos, 42);
  assert.ok(cat.resumo.temCores);

  const primeiro = cat.secoes[0].produtos[0];
  assert.equal(primeiro.nome, 'Realme Note 60x 4/64gb');
  assert.deepEqual(primeiro.cores, ['Verde']);
  assert.equal(primeiro.parcelado.valor, 760);
  assert.equal(primeiro.avista.valor, 670);

  // "LANÇAMENTO" vira flag, não fica no nome.
  const a17 = [...iterarProdutos(cat)].find((p) => p.nome.includes('A17'));
  assert.equal(a17.nome, 'Samsung Galaxy A17 4G 8/256gb');
  assert.equal(a17.lancamento, true);

  // "R$ 1. 330" (milhar quebrado) tem que virar 1330.
  const redmi15 = [...iterarProdutos(cat)].find((p) => p.nome === 'Redmi 15 8/256gb');
  assert.equal(redmi15.avista.valor, 1330);

  // Todo produto tem os dois preços nesta lista.
  for (const p of iterarProdutos(cat)) {
    assert.ok(p.avista, `sem preço à vista: ${p.nome}`);
    assert.ok(p.parcelado, `sem preço parcelado: ${p.nome}`);
  }
});

test('lista da Apple: duas mensagens viram dois catálogos', () => {
  const cats = parseVarios(amostra('apple.txt'));
  assert.equal(cats.length, 2);
  assert.match(cats[0].titulo, /APPLE/i);
  assert.match(cats[1].titulo, /Semi-Novos/i);

  assert.equal(cats[0].resumo.totalProdutos, 5);
  assert.equal(cats[1].resumo.totalProdutos, 21);

  // Cor dentro do negrito: "iPhone 14 256gb - Branco"
  const p = cats[0].secoes[0].produtos[0];
  assert.equal(p.nome, 'iPhone 14 256gb');
  assert.deepEqual(p.cores, ['Branco']);

  // Observação entre parênteses.
  const semi = cats[1].secoes[0].produtos[0];
  assert.equal(semi.nome, 'iPhone 13 128gb');
  assert.equal(semi.observacao, 'Bateria 80%');
});

test('lista de TVs: parcela + total na mesma linha', () => {
  const cat = parse(amostra('tvs.txt'));
  assert.equal(cat.resumo.totalProdutos, 14);
  assert.equal(cat.resumo.temCores, false);

  const philco = cat.secoes[0].produtos[0];
  assert.match(philco.nome, /Philco/);
  assert.equal(philco.parcelado.parcelas, 10);
  assert.equal(philco.parcelado.valorParcela, 99.99);
  assert.equal(philco.parcelado.valor, 999.99);
  assert.equal(philco.avista.valor, 885);
});

test('lista de acessórios: preço embutido e formatos variados', () => {
  const cat = parse(amostra('acessorios.txt'));
  assert.equal(cat.resumo.totalProdutos, 28);

  const todos = [...iterarProdutos(cat)];

  // Preço embutido na linha do produto, sem linha de preço abaixo.
  const cabo = todos.find((p) => p.nome.includes('Cabo USB'));
  assert.ok(cabo, 'cabo USB não encontrado');
  assert.equal(cabo.avista.valor, 15);

  // "- Preta - 180w RMS Bluetooth": pega a cor, ignora a especificação.
  const jbl = todos.find((p) => p.nome.includes('Boombox 3') && p.cores.includes('Preta'));
  assert.ok(jbl, 'JBL Boombox 3 preta não encontrada');

  // Ordem invertida (dinheiro antes do parcelado) tem que funcionar.
  const ar = todos.find((p) => p.nome.includes('Ar Condiciando'));
  assert.equal(ar.avista.valor, 2499);
  assert.equal(ar.parcelado.valor, 2780);
  assert.equal(ar.parcelado.parcelas, 10);

  // Nenhum produto pode ficar sem preço nenhum.
  const semPreco = todos.filter((p) => !p.avista && !p.parcelado);
  assert.deepEqual(semPreco.map((p) => p.nome), []);
});

test('formatarValor usa o padrão pt-BR', () => {
  assert.equal(formatarValor(1330), '1.330');
  assert.equal(formatarValor(999.99), '999,99');
  assert.equal(formatarValor(2780), '2.780');
});

test('entrada vazia não quebra', () => {
  const cat = parse('');
  assert.equal(cat.resumo.totalProdutos, 0);
  assert.deepEqual(parseVarios(''), []);
});

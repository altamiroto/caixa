/**
 * Testes das paletas.
 *
 * São 17 temas escritos à mão. Sem conferência automática, um deles erra o
 * contraste e ninguém percebe até o catálogo já estar publicado — foi o que
 * quase aconteceu com o tema de Natal, que tinha tinta escura sobre linha
 * escura. Aqui cada par que aparece na página é medido.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { TEMAS, TEMA_PADRAO, obterTema, listarTemas, varsCss } from '../src/themes/temas.js';
import {
  gerarTema,
  catalogoGerado,
  sortearTema,
  distanciaDeMatiz,
  FAMILIAS,
  ESTILOS,
} from '../src/themes/gerador.js';
import { piorRazao, baseOpaca } from './contraste.mjs';

/** Todo token que a folha de estilo consulta. Faltar um vira cor herdada errada. */
const TOKENS = [
  'fundo', 'fundo-brilho', 'foto-veu',
  'tinta', 'tinta-suave', 'destaque', 'titulo', 'titulo-realce',
  'secao-fundo', 'secao-tinta',
  'linha-tinta', 'linha-tinta-suave', 'linha-a', 'linha-b', 'linha-borda',
  'pilula-fundo', 'pilula-tinta',
  'preco-parcelado-fundo', 'preco-parcelado-tinta',
  'preco-avista-fundo', 'preco-avista-tinta',
  'selo-fundo', 'selo-tinta', 'rodape-tinta',
];

/**
 * Mínimos exigidos, escolhidos pelo tamanho que o elemento realmente tem no
 * pior caso (o piso em px definido em catalogo.css, não o tamanho na escala 1).
 *
 * A WCAG separa "texto grande" (>=18.66px em bold) com piso 3.0 de texto normal
 * com piso 4.5. Preço tem piso de 19px em peso 900 e título nunca cai abaixo de
 * 48px — esses são grandes. Selo (9px), pílula (11px), nome (13px) e faixa de
 * seção (15px) não são, e ficam no piso mais alto.
 */
const GRANDE = 3.0;
const NORMAL = 4.5;

test('todo tema declara todos os tokens', () => {
  for (const [id, tema] of Object.entries(TEMAS)) {
    assert.equal(tema.id, id, `id divergente em "${id}"`);
    assert.ok(tema.nome, `tema "${id}" sem nome`);
    for (const token of TOKENS) {
      assert.ok(tema.vars[`--${token}`], `tema "${id}" não declara --${token}`);
    }
  }
});

test('todo tema é legível', () => {
  const falhas = [];

  for (const [id, tema] of Object.entries(TEMAS)) {
    const v = (nome) => tema.vars[`--${nome}`];
    const base = baseOpaca(v('fundo'));

    const conferir = (rotulo, frente, fundo, sobre, minimo) => {
      const r = piorRazao(frente, fundo, sobre);
      if (r < minimo) {
        falhas.push(`${id} · ${rotulo}: ${r.toFixed(2)} (mínimo ${minimo})`);
      }
    };

    // A linha tem dois fundos alternados; os dois precisam servir.
    for (const faixa of ['linha-a', 'linha-b']) {
      conferir(`nome sobre ${faixa}`, v('linha-tinta'), v(faixa), base, NORMAL);
      conferir(`observação sobre ${faixa}`, v('linha-tinta-suave'), v(faixa), base, GRANDE);
    }

    // O que fica dentro da linha compõe sobre ela, não sobre o fundo da página.
    const sobreLinha = { ...base };
    conferir('preço à vista', v('preco-avista-tinta'), v('preco-avista-fundo'), sobreLinha, GRANDE);
    conferir('preço parcelado', v('preco-parcelado-tinta'), v('preco-parcelado-fundo'), sobreLinha, GRANDE);
    conferir('pílula de cor', v('pilula-tinta'), v('pilula-fundo'), sobreLinha, NORMAL);
    conferir('selo NOVO', v('selo-tinta'), v('selo-fundo'), sobreLinha, NORMAL);

    // Cabeçalho e faixa de seção ficam sobre o fundo da página.
    conferir('título', v('titulo'), v('fundo'), base, GRANDE);
    conferir('rótulo de coluna', v('tinta-suave'), v('fundo'), base, GRANDE);
    conferir('faixa de seção', v('secao-tinta'), v('secao-fundo'), base, NORMAL);
    conferir('data no cabeçalho', v('selo-tinta'), v('selo-fundo'), base, NORMAL);
  }

  assert.deepEqual(falhas, [], `contraste insuficiente:\n  ${falhas.join('\n  ')}`);
});

test('obterTema cai no padrão quando o id não existe', () => {
  assert.equal(obterTema('nao-existe').id, TEMA_PADRAO);
  assert.equal(obterTema(undefined).id, TEMA_PADRAO);
  assert.equal(obterTema('natal').id, 'natal');
});

test('listarTemas devolve todos, com nome legível', () => {
  const lista = listarTemas();
  assert.equal(lista.length, Object.keys(TEMAS).length);
  for (const t of lista) assert.ok(t.id && t.nome, `entrada incompleta: ${JSON.stringify(t)}`);
});

test('varsCss aceita sobrescrita pontual', () => {
  const css = varsCss('noite', { '--fundo': '#123456' });
  assert.match(css, /--fundo:#123456/);
  assert.match(css, /--linha-tinta:/);
});

// ------------------------------------------------------------------ gerador

test('o gerador entrega tema completo e determinístico', () => {
  const a = gerarTema({ matiz: 210, familia: 'escuro', estilo: 'capsula' });
  const b = gerarTema({ matiz: 210, familia: 'escuro', estilo: 'capsula' });

  assert.deepEqual(a.vars, b.vars, 'mesma entrada tem que dar a mesma paleta');
  for (const token of TOKENS) {
    assert.ok(a.vars[`--${token}`], `tema gerado não declara --${token}`);
  }
  assert.ok(a.vars['--raio-mult'], 'o estilo precisa chegar ao CSS');
  assert.equal(a.familia, 'escuro');
  assert.equal(a.estilo, 'capsula');
});

test('o catálogo gerado passa de cem temas, sem id repetido', () => {
  const gerados = catalogoGerado();
  assert.ok(gerados.length >= 100, `só ${gerados.length} temas gerados`);
  const ids = new Set(gerados.map((t) => t.id));
  assert.equal(ids.size, gerados.length, 'id repetido no catálogo gerado');
});

/*
 * O teste acima cobre os temas do catálogo. Este cobre o *gerador*: o sorteio
 * pode produzir qualquer matiz, então a garantia precisa valer para todas —
 * não só para as 26 que entraram na lista fixa.
 */
test('qualquer matiz gera paleta legível, em qualquer família e estilo', () => {
  const falhas = [];

  for (let h = 0; h < 360; h += 10) {
    for (const familia of FAMILIAS) {
      for (const estilo of ESTILOS) {
        const tema = gerarTema({ matiz: h, familia, estilo });
        const v = (nome) => tema.vars[`--${nome}`];
        const base = baseOpaca(v('fundo'));

        const conferir = (rotulo, frente, fundo, minimo) => {
          const r = piorRazao(frente, fundo, base);
          if (r < minimo) {
            falhas.push(`${h}° ${familia}/${estilo} · ${rotulo}: ${r.toFixed(2)} < ${minimo}`);
          }
        };

        for (const faixa of ['linha-a', 'linha-b']) {
          conferir(`nome sobre ${faixa}`, v('linha-tinta'), v(faixa), NORMAL);
          conferir(`observação sobre ${faixa}`, v('linha-tinta-suave'), v(faixa), GRANDE);
        }
        conferir('preço à vista', v('preco-avista-tinta'), v('preco-avista-fundo'), GRANDE);
        conferir('preço parcelado', v('preco-parcelado-tinta'), v('preco-parcelado-fundo'), GRANDE);
        conferir('pílula', v('pilula-tinta'), v('pilula-fundo'), NORMAL);
        conferir('selo', v('selo-tinta'), v('selo-fundo'), NORMAL);
        conferir('título', v('titulo'), v('fundo'), GRANDE);
        conferir('faixa de seção', v('secao-tinta'), v('secao-fundo'), NORMAL);
      }
    }
  }

  assert.deepEqual(falhas.slice(0, 12), [], `${falhas.length} combinações ilegíveis`);
});

test('distanciaDeMatiz mede pelo caminho curto do círculo', () => {
  assert.equal(distanciaDeMatiz(10, 350), 20);
  assert.equal(distanciaDeMatiz(190, 0), 170);
  assert.equal(distanciaDeMatiz(0, 180), 180);
  assert.equal(distanciaDeMatiz(45, 45), 0);
});

test('sorteios seguidos caem longe uns dos outros', () => {
  const matizes = [];
  for (let i = 0; i < 12; i += 1) {
    matizes.push(sortearTema({ contador: i, evitar: matizes.slice(-6) }).matiz);
  }

  // Consecutivos bem separados: é o que dá a sensação de "sempre diferente".
  for (let i = 1; i < matizes.length; i += 1) {
    const d = distanciaDeMatiz(matizes[i], matizes[i - 1]);
    assert.ok(d >= 40, `sorteios ${i - 1} e ${i} a apenas ${d}° (${matizes[i - 1]}° e ${matizes[i]}°)`);
  }

  // E o conjunto cobre o círculo, em vez de se concentrar num setor.
  assert.ok(new Set(matizes).size >= 10, 'o sorteio está repetindo matiz');
});

test('o sorteio varia também a família e o estilo', () => {
  const combos = new Set();
  for (let i = 0; i < 16; i += 1) {
    const t = sortearTema({ contador: i });
    combos.add(`${t.familia}/${t.estilo}`);
  }
  assert.equal(combos.size, 16, 'as 16 combinações de família e estilo têm que aparecer');
});

test('obterTema aceita o objeto do tema, não só o id', () => {
  // A paginação roda no navegador, que tem outra instância deste módulo: um
  // tema sorteado no Node só atravessa se for passado inteiro.
  const sorteado = sortearTema({ contador: 7 });
  assert.equal(obterTema(sorteado).id, sorteado.id);
  assert.match(varsCss(sorteado), /--raio-mult:/);

  // E o id de um tema sorteado, sozinho, cai no padrão — como esperado.
  assert.equal(obterTema(sorteado.id).id, TEMA_PADRAO);
});

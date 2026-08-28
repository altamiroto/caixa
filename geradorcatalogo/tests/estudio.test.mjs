/**
 * Teste de fumaça do estúdio (index.html).
 *
 * Confere o caminho completo dentro do navegador: colar texto -> parse ->
 * paginação -> pré-visualização -> exportação PNG. É o teste que pega
 * regressões de CSS e de módulo que o teste do parser não enxerga.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'http://gerador.local';
const TIPOS = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

function acharChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const raizes = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!raizes || !existsSync(raizes)) return undefined;
  for (const n of readdirSync(raizes).filter((x) => x.startsWith('chromium-')).sort().reverse()) {
    const alvo = join(raizes, n, 'chrome-linux', 'chrome');
    if (existsSync(alvo)) return alvo;
  }
  return undefined;
}

async function abrirEstudio() {
  const navegador = await chromium.launch({ executablePath: acharChromium() });
  const pagina = await navegador.newPage({ viewport: { width: 1600, height: 1000 } });

  await pagina.route(`${HOST}/**`, async (rota) => {
    const url = new URL(rota.request().url());
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\.]+)/, '') || 'index.html';
    const caminho = join(RAIZ, rel);
    if (!caminho.startsWith(RAIZ)) return rota.abort();
    try {
      const corpo = await readFile(caminho);
      await rota.fulfill({
        body: corpo,
        contentType: TIPOS[rel.slice(rel.lastIndexOf('.'))] ?? 'application/octet-stream',
      });
    } catch {
      await rota.fulfill({ status: 404, body: 'não encontrado' });
    }
  });

  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('console', (m) => m.type() === 'error' && erros.push(m.text()));

  await pagina.goto(`${HOST}/index.html`, { waitUntil: 'networkidle' });
  await pagina.waitForSelector('#listas textarea');
  return { navegador, pagina, erros };
}

/**
 * Preenche as caixas de lista, criando as que faltarem.
 * As caixas são dinâmicas, então o teste não pode assumir um id fixo.
 */
async function preencher(pagina, textos) {
  const lista = [].concat(textos);
  for (let i = 1; i < lista.length; i += 1) await pagina.click('#adicionar');
  const campos = pagina.locator('#listas textarea');
  for (const [i, texto] of lista.entries()) await campos.nth(i).fill(texto);
}

test('estúdio gera pré-visualização e exporta PNG em 4K', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  const lista = await readFile(join(RAIZ, 'samples/smartphones.txt'), 'utf8');
  await preencher(pagina, lista);
  await pagina.selectOption('#tema', 'noite');
  await pagina.fill('#marca', '@sualoja');
  await pagina.click('#gerar');

  await pagina.waitForSelector('.moldura .pagina', { timeout: 15000 });

  // A lista maior (42 produtos + 3 seções) tem que caber numa imagem só —
  // é o requisito explícito para o catálogo de celulares.
  const paginas = await pagina.locator('.moldura .pagina').count();
  assert.equal(paginas, 1, 'a lista de celulares tem que caber em uma página');

  const resumo = await pagina.textContent('#resumo');
  assert.match(resumo, /42 produtos/);
  assert.match(resumo, /2160×3840/);

  // Todos os 45 blocos (42 produtos + 3 seções) precisam estar desenhados:
  // caber numa página não pode significar cortar produto.
  const blocos = await pagina.locator('.moldura .pagina .linha').count();
  assert.equal(blocos, 42, 'produto sumiu ao comprimir para uma página');

  // Nenhuma linha pode vazar da área útil da página.
  const vazamentos = await pagina.evaluate(() => {
    const fora = [];
    for (const p of document.querySelectorAll('.moldura .pagina')) {
      const limite = p.getBoundingClientRect();
      for (const linha of p.querySelectorAll('.linha, .secao')) {
        const r = linha.getBoundingClientRect();
        if (r.bottom > limite.bottom + 0.5 || r.top < limite.top - 0.5) {
          fora.push(linha.textContent.slice(0, 40));
        }
      }
    }
    return fora;
  });
  assert.deepEqual(vazamentos, [], 'linhas fora da página');

  // A fonte embutida precisa estar realmente em uso. Se cair na fonte de
  // reserva, a paginação mede alturas erradas e o catálogo sai diferente em
  // cada máquina — que é exatamente o que embutir a fonte deveria evitar.
  const fonte = await pagina.evaluate(() => ({
    carregada: document.fonts.check('900 62px Inter'),
    aplicada: getComputedStyle(document.querySelector('.moldura .pagina')).fontFamily,
    embutida: [...document.fonts].some((f) => f.family === 'Inter' && f.status === 'loaded'),
  }));
  assert.ok(fonte.carregada, 'Inter não carregou');
  assert.ok(fonte.embutida, 'Inter não veio do arquivo embutido');
  assert.match(fonte.aplicada, /^"?Inter"?,/, `família aplicada: ${fonte.aplicada}`);

  // Exportação: o PNG precisa sair com 2160 px de largura.
  const dimensoes = await pagina.evaluate(async () => {
    const { paraPng } = await import('./src/render/export.js');
    const alvo = document.querySelector('.moldura .pagina');
    alvo.style.transform = 'none';
    const blob = await paraPng(alvo);
    alvo.style.transform = '';
    const bitmap = await createImageBitmap(blob);
    return { largura: bitmap.width, altura: bitmap.height, bytes: blob.size };
  });

  assert.equal(dimensoes.largura, 2160);
  assert.equal(dimensoes.altura, 3840);
  assert.ok(dimensoes.bytes > 20000, `PNG suspeito de estar vazio (${dimensoes.bytes} bytes)`);

  assert.deepEqual(erros, [], 'erros no console do navegador');
});

test('estúdio separa mensagens coladas em catálogos distintos', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  const lista = await readFile(join(RAIZ, 'samples/apple.txt'), 'utf8');
  await preencher(pagina, lista);
  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina', { timeout: 15000 });

  const resumo = await pagina.textContent('#resumo');
  assert.match(resumo, /2 catálogo\(s\)/);
  assert.deepEqual(erros, []);
});

test('o checkbox de tema aleatório troca a paleta a cada geração', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  await pagina.evaluate(() => localStorage.removeItem('gc:sorteio'));
  await preencher(pagina, await readFile(join(RAIZ, 'samples/tvs.txt'), 'utf8'));

  // Sem o sorteio, duas gerações seguidas dão exatamente o mesmo fundo.
  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina');
  const fundoDe = () =>
    pagina.$eval('.moldura .pagina', (el) => getComputedStyle(el).backgroundImage);
  const fixo1 = await fundoDe();
  await pagina.click('#gerar');
  assert.equal(await fixo1, await fundoDe(), 'sem sorteio o tema tem que ser estável');

  // Ligado, cada geração traz uma paleta diferente da anterior.
  await pagina.check('#tema-aleatorio');
  await pagina.waitForSelector('.moldura .pagina');
  assert.ok(await pagina.isDisabled('#tema'), 'o seletor de tema deve ficar inerte');

  const fundos = [await fundoDe()];
  for (let i = 0; i < 3; i += 1) {
    await pagina.click('#gerar');
    await pagina.waitForSelector('.moldura .pagina');
    fundos.push(await fundoDe());
  }
  assert.equal(new Set(fundos).size, fundos.length, `paleta repetida: ${fundos.length} gerações`);

  // O nome do tema sorteado precisa aparecer, senão não dá para repetir depois.
  assert.match(await pagina.textContent('#resumo'), /temas: .+/);
  assert.deepEqual(erros, []);
});

test('layout de duas colunas pareia sem atravessar seção nem vazar da página', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  await preencher(pagina, await readFile(join(RAIZ, 'samples/smartphones.txt'), 'utf8'));
  await pagina.selectOption('#layout', 'duplo');
  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina');

  // Realme 10, Samsung 6, Xiaomi 26 produtos: 5 + 3 + 13 pares, nenhum vazio,
  // porque o pareamento respeita a fronteira de seção.
  assert.equal(await pagina.locator('.moldura .par').count(), 21);
  assert.equal(await pagina.locator('.moldura .par__vazio').count(), 0);
  assert.equal(await pagina.locator('.moldura .linha').count(), 42, 'produto sumiu no pareamento');

  // Duas colunas têm que render mais: mesma página única, escala bem maior.
  const escala = await pagina.$eval('.moldura .pagina', (el) =>
    Number(getComputedStyle(el).getPropertyValue('--escala')),
  );
  assert.equal(await pagina.locator('.moldura .pagina').count(), 1);
  assert.ok(escala > 0.6, `esperava escala bem acima da tabela (0.34), veio ${escala}`);

  const vazamentos = await pagina.evaluate(() => {
    const p = document.querySelector('.moldura .pagina');
    const limite = p.getBoundingClientRect();
    return [...p.querySelectorAll('.par, .secao')]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > limite.bottom + 0.5 || r.top < limite.top - 0.5;
      })
      .map((el) => el.textContent.slice(0, 40));
  });
  assert.deepEqual(vazamentos, [], 'bloco fora da página');
  assert.deepEqual(erros, []);
});

test('seção com número ímpar de produtos deixa uma vaga vazia, não um cartão largo', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  // A lista de acessórios tem uma seção só, com 28 produtos... e a de iPhones
  // semi-novos tem 21, que é ímpar.
  await preencher(pagina, await readFile(join(RAIZ, 'samples/apple.txt'), 'utf8'));
  await pagina.selectOption('#layout', 'grade');
  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina');

  // 5 produtos (ímpar) + 21 produtos (ímpar) = duas vagas vazias.
  assert.equal(await pagina.locator('.moldura .par__vazio').count(), 2);
  assert.equal(await pagina.locator('.moldura .cartao').count(), 26);
  assert.deepEqual(erros, []);
});

// ------------------------------------------------------------ várias listas

test('várias caixas geram todos os catálogos de uma vez', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  // Começa com uma caixa só; as outras vêm do botão.
  assert.equal(await pagina.locator('#listas textarea').count(), 1);

  await preencher(pagina, [
    await readFile(join(RAIZ, 'samples/tvs.txt'), 'utf8'),
    await readFile(join(RAIZ, 'samples/smartphones.txt'), 'utf8'),
    await readFile(join(RAIZ, 'samples/apple.txt'), 'utf8'),
  ]);
  assert.equal(await pagina.locator('#listas textarea').count(), 3);

  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina');

  // TVs (1) + smartphones (1) + Apple, que sozinha rende dois catálogos = 4.
  const resumo = await pagina.textContent('#resumo');
  assert.match(resumo, /4 catálogo\(s\)/);
  assert.equal(await pagina.locator('.moldura .pagina').count(), 4);

  // 14 + 42 + 5 + 21
  assert.match(resumo, /82 produtos/);

  // Cada prévia tem o seu botão, e existe um para baixar tudo de uma vez.
  assert.equal(await pagina.locator('.previa__acoes button').count(), 4);
  assert.equal(await pagina.locator('#baixar-todas').count(), 1);
  assert.deepEqual(erros, []);
});

test('a prévia não estica além do que ela mostra', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  /*
   * Regressão real: a prévia se chamava `.cartao`, o mesmo nome do cartão de
   * produto em catalogo.css, e herdava dali `height: 100%`. Cada prévia
   * esticava até a altura do palco e abria um vão de mais de 1400px até a
   * seguinte. Em tela estreita, onde cada uma fica na sua linha, o defeito
   * aparecia inteiro — daí a janela de celular aqui.
   */
  await pagina.setViewportSize({ width: 390, height: 900 });
  await preencher(pagina, [
    await readFile(join(RAIZ, 'samples/tvs.txt'), 'utf8'),
    await readFile(join(RAIZ, 'samples/smartphones.txt'), 'utf8'),
    await readFile(join(RAIZ, 'samples/acessorios.txt'), 'utf8'),
  ]);

  await pagina.click('#gerar');
  await pagina.waitForSelector('.previa');

  const medidas = await pagina.evaluate(() => {
    const previas = [...document.querySelectorAll('.previa')];
    const caixas = previas.map((p) => ({
      previa: p.getBoundingClientRect(),
      soma:
        p.querySelector('.moldura').getBoundingClientRect().height +
        p.querySelector('.previa__acoes').getBoundingClientRect().height,
    }));
    return {
      // Quanto cada prévia passa da altura do que ela de fato mostra.
      sobras: caixas.map((c) => Math.round(c.previa.height - c.soma)),
      vaos: caixas
        .slice(1)
        .map((c, i) => Math.round(c.previa.top - caixas[i].previa.bottom)),
    };
  });

  // O gap de 8px entre a moldura e a linha de ações é a única folga esperada.
  for (const sobra of medidas.sobras) assert.ok(sobra <= 10, `sobra de ${sobra}px na prévia`);
  // E entre uma prévia e a próxima, só o gap do palco.
  for (const vao of medidas.vaos) assert.ok(vao <= 30, `vão de ${vao}px entre prévias`);
  assert.deepEqual(erros, []);
});

test('o botão de cada prévia salva, não compartilha', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  await preencher(pagina, [await readFile(join(RAIZ, 'samples/tvs.txt'), 'utf8')]);
  await pagina.click('#gerar');
  await pagina.waitForSelector('.previa__acoes button');

  const rotulos = await pagina.locator('.previa__acoes button').allTextContents();
  for (const r of rotulos) assert.equal(r, 'Salvar imagem');

  // Mesmo num aparelho que oferece a folha nativa, o caminho é o download.
  await pagina.evaluate(() => {
    window.__compartilhou = false;
    navigator.share = async () => {
      window.__compartilhou = true;
    };
    navigator.canShare = () => true;
  });

  const baixado = pagina.waitForEvent('download');
  await pagina.locator('.previa__acoes button').first().click();
  await baixado;

  assert.equal(await pagina.evaluate(() => window.__compartilhou), false);
  assert.deepEqual(erros, []);
});

test('caixa vazia é ignorada e remover uma não derruba as outras', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  await preencher(pagina, [
    await readFile(join(RAIZ, 'samples/tvs.txt'), 'utf8'),
    '   ',
    await readFile(join(RAIZ, 'samples/smartphones.txt'), 'utf8'),
  ]);

  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina');
  assert.match(await pagina.textContent('#resumo'), /2 catálogo\(s\)/);

  // Remove a do meio (a vazia); as outras duas continuam.
  await pagina.locator('.lista__remover').nth(1).click();
  assert.equal(await pagina.locator('#listas textarea').count(), 2);

  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina');
  assert.match(await pagina.textContent('#resumo'), /2 catálogo\(s\)/);
  assert.deepEqual(erros, []);
});

test('com uma lista só o botão de remover fica escondido', async (t) => {
  const { navegador, pagina } = await abrirEstudio();
  t.after(() => navegador.close());

  assert.equal(await pagina.locator('.lista__remover').first().isVisible(), false);
  await pagina.click('#adicionar');
  assert.equal(await pagina.locator('.lista__remover').first().isVisible(), true);

  // Voltando a uma, some de novo — a tela nunca fica sem entrada nenhuma.
  await pagina.locator('.lista__remover').nth(1).click();
  assert.equal(await pagina.locator('.lista__remover').first().isVisible(), false);
});

test('listas de mesmo título não se sobrescrevem no download', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  const tvs = await readFile(join(RAIZ, 'samples/tvs.txt'), 'utf8');
  await preencher(pagina, [tvs, tvs]);
  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina');

  assert.equal(await pagina.locator('.moldura .pagina').count(), 2);

  // Os dois catálogos têm o mesmo título; o nome do arquivo precisa diferir,
  // senão o segundo download sobrescreve o primeiro.
  // Espera o evento de cada download, não um intervalo fixo: sob carga o
  // tempo fixo às vezes não bastava e o teste falhava sem haver defeito.
  const nomes = [];
  for (const b of await pagina.locator('.previa__acoes button').all()) {
    const [download] = await Promise.all([pagina.waitForEvent('download'), b.click()]);
    nomes.push(download.suggestedFilename());
  }

  assert.equal(nomes.length, 2, `esperava 2 downloads, veio ${nomes.length}`);
  assert.notEqual(nomes[0], nomes[1], `os dois vieram como "${nomes[0]}"`);
  assert.deepEqual(erros, []);
});

test('baixar várias vezes seguidas continua funcionando', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  // O relato veio do celular: depois do primeiro download, nenhum outro saía
  // sem recarregar a página. Aqui o mesmo botão é acionado várias vezes e
  // depois os dos outros catálogos, sem recarregar nada no meio.
  await preencher(pagina, [
    await readFile(join(RAIZ, 'samples/tvs.txt'), 'utf8'),
    await readFile(join(RAIZ, 'samples/apple.txt'), 'utf8'),
  ]);
  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina');

  const botoes = await pagina.locator('.previa__acoes button').all();
  assert.equal(botoes.length, 3);

  const baixar = async (botao) => {
    const [download] = await Promise.all([
      pagina.waitForEvent('download', { timeout: 20000 }),
      botao.click(),
    ]);
    return download.suggestedFilename();
  };

  // Três vezes o mesmo botão: a partir da segunda o PNG vem do cache.
  for (let i = 0; i < 3; i += 1) {
    assert.match(await baixar(botoes[0]), /\.png$/, `repetição ${i + 1} falhou`);
  }

  // E os outros continuam respondendo depois disso.
  for (const botao of botoes.slice(1)) {
    assert.match(await baixar(botao), /\.png$/);
  }

  assert.deepEqual(erros, []);
});

test('a prévia volta ao tamanho normal mesmo se a exportação falhar', async (t) => {
  const { navegador, pagina } = await abrirEstudio();
  t.after(() => navegador.close());

  await preencher(pagina, await readFile(join(RAIZ, 'samples/tvs.txt'), 'utf8'));
  await pagina.click('#gerar');
  await pagina.waitForSelector('.moldura .pagina');

  const antes = await pagina.$eval('.moldura .pagina', (el) => getComputedStyle(el).transform);

  // Força a falha: sem canvas utilizável, paraPng lança.
  await pagina.evaluate(() => {
    HTMLCanvasElement.prototype.getContext = () => {
      throw new Error('memória insuficiente (simulado)');
    };
  });
  await pagina.locator('.previa__acoes button').first().click();
  await pagina.waitForFunction(() => document.querySelector('#avisos li'));

  const depois = await pagina.$eval('.moldura .pagina', (el) => getComputedStyle(el).transform);
  assert.equal(depois, antes, 'a prévia ficou com a escala da exportação');

  // E o erro precisa ficar visível, não sumir em silêncio.
  assert.match(await pagina.textContent('#avisos'), /memória insuficiente/);
});

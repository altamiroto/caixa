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
  return { navegador, pagina, erros };
}

test('estúdio gera pré-visualização e exporta PNG em 4K', async (t) => {
  const { navegador, pagina, erros } = await abrirEstudio();
  t.after(() => navegador.close());

  const lista = await readFile(join(RAIZ, 'samples/smartphones.txt'), 'utf8');
  await pagina.fill('#entrada', lista);
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
  await pagina.fill('#entrada', lista);
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
  await pagina.fill('#entrada', await readFile(join(RAIZ, 'samples/tvs.txt'), 'utf8'));

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
  assert.match(await pagina.textContent('#resumo'), /tema: .+/);
  assert.deepEqual(erros, []);
});

/**
 * Testes de navegador do comparador (wtela/index.html).
 *
 * Abre a página num Chromium de verdade e confere busca, ranking de preços,
 * rascunho local, desfazer, histórico, arquivo e IA. As APIs externas
 * (Apps Script, proxy de IA, Google) são simuladas — nada sai da máquina.
 *
 *   cd wtela && npm install && npm test
 *
 * As listas reais usadas vêm de geradorcatalogo/samples.
 */
import assert from 'node:assert/strict';
import { readFile, mkdtemp } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const HOST = 'https://wtela.local';
const SAIDA = process.env.SAIDA || await mkdtemp(join(tmpdir(), 'wtela-'));
const apple = await readFile(`${RAIZ}/geradorcatalogo/samples/apple.txt`, 'utf8');
const smartphones = await readFile(`${RAIZ}/geradorcatalogo/samples/smartphones.txt`, 'utf8');

/** Usa o Chromium já instalado no ambiente quando a versão do Playwright não bate. */
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

const LOJA_SIMPLES = [
  '*LOJA CENTRO - 10/09*',
  'iPhone 15 128GB Preto - R$ 4.350',
  'iPhone 15 256 GB Azul - R$ 4.990',
  'iPhone 15 Pro Max 256gb - R$ 7.100',
  'Galaxy S24 Ultra 512gb 💰 6.200',
  '𝐈𝐏𝐇𝐎𝐍𝐄 𝟏𝟑 128GB - 2.899,00',
  'Arroz 5kg',
  'Feijão 1kg - R$ 8,50',
  'Ar Condicionado 12.000 BTUS Frio',
  'R$ 1.999 (pix)',
  'Cabo 1,50m - R$ 15',
].join('\n');

const navegador = await chromium.launch({ executablePath: acharChromium() });
let falhas = 0;
const pedidosIA = [];

async function abrir({ largura = 1400, contexto = null } = {}) {
  const ctx = contexto ?? await navegador.newContext({ viewport: { width: largura, height: 900 }, acceptDownloads: true });
  const pagina = await ctx.newPage();
  // Área de transferência simulada: a real exige permissão que este Chromium não concede.
  await pagina.addInitScript(() => {
    let conteudo = '';
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (t) => { conteudo = String(t); }, readText: async () => conteudo },
    });
  });
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));
  pagina.on('console', (m) => m.type() === 'error' && erros.push(m.text()));

  await pagina.route(`${HOST}/**`, async (rota) => {
    await rota.fulfill({ body: await readFile(`${RAIZ}/wtela/index.html`), contentType: 'text/html; charset=utf-8' });
  });
  await pagina.route('https://script.google.com/**', async (rota) => {
    if (rota.request().method() === 'POST') {
      pedidosIA.push({ tipo: 'salvar', corpo: rota.request().postData() });
      return rota.fulfill({ body: JSON.stringify({ status: 'success' }), contentType: 'application/json' });
    }
    return rota.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        { date: '2026-09-01T10:00:00Z', tag: 'antigo', suppliers: JSON.stringify([{ name: 'A', text: 'x' }]) },
        { date: '2026-09-20T10:00:00Z', tag: 'Semana 38', suppliers: JSON.stringify([{ name: 'Loja H', text: 'iPhone 16 - R$ 5.000' }, { name: 'Loja I', text: 'Galaxy - R$ 3.000' }]) },
      ]),
    });
  });
  await pagina.route('https://caixa-kal3.vercel.app/**', async (rota) => {
    const req = rota.request();
    if (req.method() === 'GET') {
      return rota.fulfill({ contentType: 'application/json', body: JSON.stringify({ models: [
        { name: 'models/gemini-9-flash', displayName: 'Gemini 9 Flash', inputTokenLimit: 1000000, supportedGenerationMethods: ['generateContent'] },
        { name: 'models/gemini-embed', displayName: 'Embed', supportedGenerationMethods: ['embedContent'] },
      ] }) });
    }
    const corpo = JSON.parse(req.postData());
    pedidosIA.push({ tipo: 'proxy', corpo });
    if (corpo.model === 'modelo-quebrado') {
      return rota.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Erro na API Gemini', details: { error: { message: 'models/modelo-quebrado is not found' } } }) });
    }
    if (corpo.model === 'modelo-lento') {
      await new Promise((r) => setTimeout(r, 4000));
    }
    return rota.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '## iPhone 15\n**Menor Preço: R$ 4.350**\n- Loja Centro' }, finishReason: 'STOP' }] }) });
  });
  await pagina.route('https://generativelanguage.googleapis.com/**', async (rota) => {
    const req = rota.request();
    pedidosIA.push({ tipo: 'google', url: req.url(), headers: req.headers() });
    return rota.fulfill({ contentType: 'application/json', body: JSON.stringify({ models: [
      { name: 'models/gemini-direto-x', displayName: 'Direto X', supportedGenerationMethods: ['generateContent'] },
    ] }) });
  });

  await pagina.goto(`${HOST}/wtela/index.html`);
  await pagina.waitForSelector('.cartao-forn');
  return { pagina, erros, ctx };
}

async function preencher(pagina, textos) {
  const n = textos.length;
  await pagina.fill('#numFornecedores', String(n));
  await pagina.click('#aplicarBtn');
  const cartoes = pagina.locator('.cartao-forn');
  for (let i = 0; i < n; i++) {
    const [nome, texto] = textos[i];
    await cartoes.nth(i).locator('.cartao-nome').fill(nome);
    await cartoes.nth(i).locator('.cartao-texto').fill(texto);
  }
}

async function buscar(pagina, termo, sub = '') {
  await pagina.fill('#searchInput', termo);
  await pagina.fill('#subSearchInput', sub);
  await pagina.waitForTimeout(260);
}

async function caso(nome, fn) {
  try {
    await fn();
    console.log(`ok   ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`FALHA ${nome}\n     ${e.message.split('\n').join('\n     ')}`);
  }
}

// ---------------------------------------------------------------- testes
await caso('abre sem erros, com 4 fornecedores vazios', async () => {
  const { pagina, erros, ctx } = await abrir();
  assert.equal(await pagina.locator('.cartao-forn').count(), 4);
  assert.equal(await pagina.inputValue('#numFornecedores'), '4');
  assert.match(await pagina.textContent('#buscaStatus'), /0 de 4 fornecedores com lista/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

await caso('leitura de preços em linhas reais', async () => {
  const { pagina, ctx } = await abrir();
  const r = await pagina.evaluate(() => {
    const p = (s) => precosNaLinha(normalizeForSearch(s)).valores;
    return {
      moeda: p('iPhone 15 128GB Preto - R$ 4.350'),
      semEspaco: p('R$1240 (10x)'),
      parcela: p('10 de R$ 292,50 (R$ 2.925,00)'),
      parcelaSemTotal: p('10x R$ 99,90'),
      parcelasDe: p('6 parcelas de R$ 82,99'),
      emAte: p('R$ 99 em até 3x'),
      decimal: p('𝐈𝐏𝐇𝐎𝐍𝐄 𝟏𝟑 128GB - 2.899,00'),
      milharFim: p('Xiaomi Note 13 - 1.150'),
      btu: p('Ar Condicionado 12.000 BTUS Frio'),
      capacidade: p('iPhone 13 128'),
      cabo: p('Cabo 1,50m'),
      bolsa: p('Galaxy S24 Ultra 512gb 💰 6.200'),
      typo: p('R$ 1. 330 (Dinheiro)'),
      // Fornecedor que usa vírgula como separador de milhar.
      virgulaMilhar: p('iPhone 15 128gb - R$ 4,350'),
      virgulaMilharCentavos: p('R$ 1,234,56'),
      formatoAmericano: p('R$ 1,234.56'),
      centavos: p('R$ 99,90'),
      centavosPonto: p('R$ 99.90'),
      virgulaMilharSolta: p('Xiaomi Note 13 - 1,150'),
      virgulaMilharParcela: p('10x R$ 1,299'),
      telaSolta: p('Redmi Note 13 6,67" 256gb - 1.899'),
    };
  });
  assert.deepEqual(r.moeda, [4350]);
  assert.deepEqual(r.semEspaco, [1240]);
  assert.deepEqual(r.parcela, [2925, 2925]);
  assert.deepEqual(r.parcelaSemTotal, [999]);
  assert.deepEqual(r.parcelasDe, [497.94]);
  assert.deepEqual(r.emAte, [99]);
  assert.deepEqual(r.decimal, [2899]);
  assert.deepEqual(r.milharFim, [1150]);
  assert.deepEqual(r.btu, [], '12.000 BTUS não é preço');
  assert.deepEqual(r.capacidade, [], '128 solto não é preço');
  assert.deepEqual(r.cabo, [], '1,50m não é preço');
  assert.deepEqual(r.bolsa, [6200]);
  assert.deepEqual(r.typo, [1330]);
  assert.deepEqual(r.virgulaMilhar, [4350], 'R$ 4,350 é quatro mil, não quatro reais');
  assert.deepEqual(r.virgulaMilharCentavos, [1234.56]);
  assert.deepEqual(r.formatoAmericano, [1234.56]);
  assert.deepEqual(r.centavos, [99.9]);
  assert.deepEqual(r.centavosPonto, [99.9]);
  assert.deepEqual(r.virgulaMilharSolta, [1150]);
  assert.deepEqual(r.virgulaMilharParcela, [12990]);
  assert.deepEqual(r.telaSolta, [1899], '6,67" é a tela, não o preço');
  await ctx.close();
});

await caso('busca por palavras em qualquer ordem, com destaque e ranking', async () => {
  const { pagina, erros, ctx } = await abrir();
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES], ['Smartphones', smartphones]]);
  await buscar(pagina, '15 iphone');

  const cartoes = pagina.locator('.cartao-forn:not([hidden])');
  assert.equal(await cartoes.count(), 1, 'só a Loja Centro tem iPhone 15');
  const marcas = await pagina.locator('.cartao-forn:not([hidden]) .resultado mark').allTextContents();
  assert.ok(marcas.some((m) => /iphone/i.test(m)) && marcas.includes('15'), `marcas: ${marcas}`);

  const ranking = await pagina.locator('.rank-item').allTextContents();
  assert.equal(ranking.length, 3, ranking.join(' | '));
  assert.match(ranking[0], /R\$\s?4\.350,00/);
  assert.match(ranking[1], /R\$\s?4\.990,00/);
  assert.match(ranking[2], /R\$\s?7\.100,00/);
  assert.match(await pagina.textContent('#buscaStatus'), /3 ocorrências em 1 de 2 fornecedores · 3 com preço/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

await caso('formato "nome / cartão / pix": ranking usa o menor (pix), não o nome', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Apple Import', apple], ['Loja Centro', LOJA_SIMPLES]]);
  await buscar(pagina, '17 pro max');
  const ranking = await pagina.locator('.rank-item').allTextContents();
  assert.equal(ranking.length, 2, ranking.join(' | '));
  assert.match(ranking[0], /7\.450,00.*Apple Import.*Laranja.*também.*8\.450,00/s);
  assert.match(ranking[1], /7\.499,00.*Azul/s);
  await ctx.close();
});

await caso('vírgula = OU, menos = exclui, aspas = frase, 128gb acha 128 GB, letras estilizadas', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES]]);
  const contar = async () => (await pagina.locator('.rank-item').count());

  await buscar(pagina, 'iphone 15, galaxy s24');
  assert.equal(await contar(), 4, 'OU');
  await buscar(pagina, 'iphone -pro');
  assert.equal(await contar(), 3, 'exclusão: iphone 15 128, 15 256, 13');
  await buscar(pagina, '"15 pro"');
  assert.equal(await contar(), 1, 'frase');
  await buscar(pagina, 'iphone 15 256gb');
  const r256 = await pagina.locator('.rank-item').allTextContents();
  assert.equal(r256.length, 2, '256gb ~ 256 GB (Azul) e 256gb (Pro Max)');
  assert.ok(r256.some((t) => /256 GB Azul/.test(t)));
  await buscar(pagina, 'iphone 13');
  const r = await pagina.locator('.rank-item').allTextContents();
  assert.equal(r.length, 1, 'letras estilizadas');
  assert.match(r[0], /2\.899,00/);
  await ctx.close();
});

await caso('número da busca não casa dentro de outro número', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Loja', [
    'iPhone 13 128gb - Carregador 150W - R$ 2.000',
    'iPhone 13 128gb - R$ 1.150',
    'iPhone 15 128gb - R$ 4.000',
    'iPhone 15,5 - R$ 9',
  ].join('\n')]]);
  await buscar(pagina, 'iphone 15');
  const r = await pagina.locator('.rank-item').allTextContents();
  assert.equal(r.length, 1, r.join(' | '));
  assert.match(r[0], /4\.000,00/);
  await buscar(pagina, '128');
  assert.equal(await pagina.locator('.rank-item').count(), 3, '128 acha 128gb');
  await ctx.close();
});

await caso('preço de outro produto na linha seguinte não é roubado', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES]]);
  await buscar(pagina, 'arroz');
  assert.equal(await pagina.locator('.rank-item').count(), 0, 'Arroz não tem preço; o R$ 8,50 é do Feijão');
  assert.match(await pagina.textContent('#rankingLista'), /Nenhum preço reconhecido/);
  await buscar(pagina, 'ar condicionado');
  const r = await pagina.locator('.rank-item').allTextContents();
  assert.equal(r.length, 1);
  assert.match(r[0], /1\.999,00/, 'preço na linha de baixo, 12.000 BTUS ignorado');
  await ctx.close();
});

await caso('refinar procura no contexto e destaca em outra cor', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Apple Import', apple]]);
  await buscar(pagina, 'iphone 17', 'azul');
  const r = await pagina.locator('.rank-item').allTextContents();
  assert.equal(r.length, 1, r.join(' | '));
  assert.match(r[0], /Azul/);
  assert.ok(await pagina.locator('mark.sub').count() > 0);
  assert.equal(await pagina.isVisible('#searchLegend'), true);
  await ctx.close();
});

await caso('texto da busca não vira HTML', async () => {
  const { pagina, ctx } = await abrir();
  await pagina.check('#showNoResult');
  await preencher(pagina, [['A', 'nada aqui']]);
  await buscar(pagina, '<img src=x onerror="window.__xss=1">');
  await pagina.waitForTimeout(200);
  assert.equal(await pagina.evaluate(() => window.__xss), undefined);
  assert.match(await pagina.textContent('.resultado'), /Nenhum resultado para "<img/);
  await ctx.close();
});

await caso('listas sobrevivem a recarregar a página', async () => {
  const ctx = await navegador.newContext({ viewport: { width: 1200, height: 900 } });
  const { pagina } = await abrir({ contexto: ctx });
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES], ['Apple Import', apple], ['Terceira', 'x']]);
  await pagina.fill('#tagInput', 'semana 39');
  await pagina.waitForTimeout(600);
  await pagina.reload();
  await pagina.waitForSelector('.cartao-forn');
  assert.equal(await pagina.locator('.cartao-forn').count(), 3);
  assert.equal(await pagina.locator('.cartao-nome').nth(1).inputValue(), 'Apple Import');
  assert.equal(await pagina.locator('.cartao-texto').nth(0).inputValue(), LOJA_SIMPLES);
  assert.equal(await pagina.inputValue('#tagInput'), 'semana 39');
  await ctx.close();
});

await caso('remover um fornecedor do meio e desfazer', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['A', 'lista a'], ['B', 'lista b'], ['C', 'lista c']]);
  await pagina.locator('.cartao-forn').nth(1).locator('[data-acao="remover"]').click();
  assert.deepEqual(await pagina.locator('.cartao-nome').evaluateAll((els) => els.map((e) => e.value)), ['A', 'C']);
  assert.equal(await pagina.inputValue('#numFornecedores'), '2');
  // Edita outro cartão enquanto o aviso está na tela: a edição sobrevive ao desfazer.
  await pagina.locator('.cartao-texto').nth(1).fill('lista c editada');
  await pagina.click('.toast-acao');
  assert.deepEqual(await pagina.locator('.cartao-nome').evaluateAll((els) => els.map((e) => e.value)), ['A', 'B', 'C']);
  assert.equal(await pagina.locator('.cartao-texto').nth(2).inputValue(), 'lista c editada');
  await ctx.close();
});

await caso('aplicar quantidade menor e desfazer; limpar tudo e desfazer', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['A', 'a'], ['B', 'b'], ['C', 'c'], ['D', 'd']]);
  await pagina.fill('#numFornecedores', '2');
  await pagina.click('#aplicarBtn');
  assert.equal(await pagina.locator('.cartao-forn').count(), 2);
  await pagina.click('.toast-acao');
  assert.equal(await pagina.locator('.cartao-forn').count(), 4);

  await pagina.click('#limparTudoBtn');
  assert.equal(await pagina.locator('.cartao-texto').nth(0).inputValue(), '');
  assert.equal(await pagina.locator('.cartao-nome').nth(0).inputValue(), 'A', 'nomes ficam');
  await pagina.click('.toast-acao');
  assert.equal(await pagina.locator('.cartao-texto').nth(3).inputValue(), 'd');
  await ctx.close();
});

await caso('botão colar preenche a lista a partir da área de transferência', async () => {
  const { pagina, ctx } = await abrir();
  await pagina.evaluate(() => navigator.clipboard.writeText('Lista colada\nItem - R$ 10'));
  await pagina.locator('.cartao-forn').nth(0).locator('[data-acao="colar"]').click();
  await pagina.waitForTimeout(150);
  assert.equal(await pagina.locator('.cartao-texto').nth(0).inputValue(), 'Lista colada\nItem - R$ 10');
  await ctx.close();
});

await caso('filtro por nome de fornecedor aceita vários com vírgula', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Loja Norte', 'a'], ['Loja Sul', 'b'], ['Atacado X', 'c']]);
  await pagina.fill('#supplierFilterInput', 'norte, atacado');
  await pagina.waitForTimeout(250);
  const visiveis = await pagina.locator('.cartao-forn:not([hidden]) .cartao-nome').evaluateAll((els) => els.map((e) => e.value));
  assert.deepEqual(visiveis, ['Loja Norte', 'Atacado X']);
  await ctx.close();
});

await caso('IA: trocar de provedor não sobrescreve o token do outro', async () => {
  const { pagina, ctx } = await abrir();
  await pagina.click('#secaoIA summary');
  await pagina.selectOption('#aiModelSelect', 'openrouter');
  await pagina.fill('#aiToken', 'token-openrouter');
  await pagina.selectOption('#aiModelSelect', 'openai');
  assert.equal(await pagina.inputValue('#aiToken'), '', 'campo mostra o token da OpenAI (vazio)');
  await pagina.fill('#aiToken', 'token-openai');
  await pagina.selectOption('#aiModelSelect', 'openrouter');
  assert.equal(await pagina.inputValue('#aiToken'), 'token-openrouter');
  const salvos = await pagina.evaluate(() => ({ or: localStorage.getItem('ai_token_openrouter'), oa: localStorage.getItem('ai_token_openai') }));
  assert.deepEqual(salvos, { or: 'token-openrouter', oa: 'token-openai' });
  await ctx.close();
});

await caso('IA: listar modelos do Gemini direto preenche a lista visível, token no cabeçalho', async () => {
  const { pagina, ctx } = await abrir();
  await pagina.click('#secaoIA summary');
  await pagina.selectOption('#aiModelSelect', 'gemini_direct');
  await pagina.fill('#aiToken', 'chave-google');
  pedidosIA.length = 0;
  await pagina.click('#listModelsBtn');
  await pagina.waitForTimeout(300);
  assert.equal(await pagina.isVisible('#aiModeloLista'), true);
  const opcoes = await pagina.locator('#aiModeloLista option').allTextContents();
  assert.ok(opcoes.some((o) => o.includes('Direto X')), opcoes.join(' | '));
  const pedido = pedidosIA.find((p) => p.tipo === 'google');
  assert.equal(pedido.headers['x-goog-api-key'], 'chave-google');
  assert.doesNotMatch(pedido.url, /key=/, 'token fora da URL');
  await pagina.selectOption('#aiModeloLista', 'gemini-direto-x');
  assert.equal(await pagina.inputValue('#aiModelo'), 'gemini-direto-x');
  await ctx.close();
});

await caso('IA via proxy: {PRODUTOS} trocado em todas as ocorrências, só trechos, resultado e cópia', async () => {
  const { pagina, erros, ctx } = await abrir();
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES], ['Apple Import', apple]]);
  await buscar(pagina, 'iphone 15');
  await pagina.click('#secaoIA summary');
  await pagina.fill('#aiPrompt', 'Ache {PRODUTOS}. Repito: {PRODUTOS}.');
  await pagina.check('#aiSoTrechos');
  assert.match(await pagina.textContent('#aiEstimativa'), /2 fornecedores \(trechos da busca\)/);
  pedidosIA.length = 0;
  await pagina.click('#analyzeBtn');
  await pagina.waitForSelector('#aiResultadoBox:not([hidden])');
  const pedido = pedidosIA.find((p) => p.tipo === 'proxy');
  assert.match(pedido.corpo.messages, /^Ache iphone 15\. Repito: iphone 15\./);
  assert.match(pedido.corpo.messages, /=== Loja Centro ===/);
  assert.match(pedido.corpo.messages, /=== Apple Import ===/);
  // iPad 10 fica a mais de 40 linhas do iPhone 15 mais próximo na lista da Apple.
  assert.doesNotMatch(pedido.corpo.messages, /iPad 10/, 'só trechos da busca');
  assert.ok(pedido.corpo.messages.length < LOJA_SIMPLES.length + apple.length, 'menor que as listas inteiras');
  assert.equal(pedido.corpo.model, 'gemini-3-flash-preview');
  assert.equal(await pagina.locator('#aiResult strong').first().textContent(), 'iPhone 15');
  await pagina.click('#copiarIAWhatsBtn');
  const copiado = await pagina.evaluate(() => navigator.clipboard.readText());
  assert.equal(copiado, '*iPhone 15*\n*Menor Preço: R$ 4.350*\n• Loja Centro');

  // O prompt editado fica guardado.
  await pagina.waitForTimeout(600);
  await pagina.reload();
  await pagina.waitForSelector('.cartao-forn');
  assert.equal(await pagina.inputValue('#aiPrompt'), 'Ache {PRODUTOS}. Repito: {PRODUTOS}.');
  assert.deepEqual(erros, []);
  await ctx.close();
});

await caso('IA: erro do proxy mostra o motivo real', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES]]);
  await pagina.click('#secaoIA summary');
  await pagina.fill('#aiModelo', 'modelo-quebrado');
  await pagina.fill('#productSearchAI', 'arroz');
  await pagina.click('#analyzeBtn');
  await pagina.waitForSelector('#aiResultadoBox:not([hidden])');
  assert.match(await pagina.textContent('#aiResult'), /HTTP 404 — Erro na API Gemini · models\/modelo-quebrado is not found/);
  await ctx.close();
});

await caso('IA: análise pode ser cancelada', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES]]);
  await pagina.click('#secaoIA summary');
  await pagina.fill('#aiModelo', 'modelo-lento');
  await pagina.fill('#productSearchAI', 'arroz');
  await pagina.click('#analyzeBtn');
  await pagina.waitForTimeout(700);
  assert.match(await pagina.textContent('#analyzeBtn'), /Cancelar/);
  assert.match(await pagina.textContent('#loadingIndicator'), /Analisando.*\ds/);
  await pagina.click('#analyzeBtn');
  await pagina.waitForTimeout(200);
  assert.match(await pagina.textContent('#analyzeBtn'), /Analisar com IA/);
  assert.equal(await pagina.isVisible('#aiResultadoBox'), false);
  await ctx.close();
});

await caso('histórico: salva no formato antigo e carrega registro', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Loja Centro', 'iPhone - R$ 1']]);
  await pagina.fill('#tagInput', 'minha tag');
  pedidosIA.length = 0;
  await pagina.click('#salvarBtn');
  await pagina.waitForTimeout(300);
  const salvo = new URLSearchParams(pedidosIA.find((p) => p.tipo === 'salvar').corpo);
  assert.equal(salvo.get('tag'), 'minha tag');
  assert.deepEqual(JSON.parse(salvo.get('suppliers')), [{ name: 'Loja Centro', text: 'iPhone - R$ 1' }]);

  await pagina.click('#historicoBtn');
  await pagina.waitForSelector('#historicoSelect:not([hidden])');
  const opcoes = await pagina.locator('#historicoSelect option').allTextContents();
  assert.match(opcoes[1], /Semana 38.*\[2 forn\.\]/, 'mais recente primeiro');
  pagina.once('dialog', (d) => d.accept());
  await pagina.selectOption('#historicoSelect', '0');
  await pagina.waitForTimeout(200);
  assert.deepEqual(await pagina.locator('.cartao-nome').evaluateAll((els) => els.map((e) => e.value)), ['Loja H', 'Loja I']);
  assert.equal(await pagina.inputValue('#tagInput'), 'Semana 38');
  await ctx.close();
});

await caso('exportar e importar arquivo', async () => {
  const { pagina, ctx } = await abrir();
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES], ['Apple Import', apple]]);
  const [download] = await Promise.all([pagina.waitForEvent('download'), pagina.click('#exportarBtn')]);
  const caminho = `${SAIDA}/export-teste.json`;
  await download.saveAs(caminho);
  const dados = JSON.parse(await readFile(caminho, 'utf8'));
  assert.equal(dados.fornecedores.length, 2);

  await pagina.click('#limparTudoBtn');
  await pagina.fill('#numFornecedores', '1');
  await pagina.click('#aplicarBtn');
  await pagina.setInputFiles('#importarArquivo', [
    { name: 'export-teste.json', mimeType: 'application/json', buffer: await readFile(caminho) },
    { name: 'Distribuidora Z.txt', mimeType: 'text/plain', buffer: Buffer.from('Item Z - R$ 9') },
  ]);
  await pagina.waitForTimeout(300);
  assert.deepEqual(await pagina.locator('.cartao-nome').evaluateAll((els) => els.map((e) => e.value)), ['Loja Centro', 'Apple Import', 'Distribuidora Z']);
  await ctx.close();
});

await caso('colunas: uma por fornecedor no automático, até 12, e escolha manual', async () => {
  const { pagina, erros, ctx } = await abrir({ largura: 1600 });
  const colunas = () => pagina.evaluate(() => getComputedStyle(document.getElementById('container-listas')).gridTemplateColumns.split(' ').length);

  await preencher(pagina, Array.from({ length: 5 }, (_, i) => [`F${i + 1}`, `item ${i} - R$ 10`]));
  assert.equal(await colunas(), 5, '5 fornecedores lado a lado');

  await pagina.fill('#numFornecedores', '14');
  await pagina.click('#aplicarBtn');
  assert.equal(await colunas(), 12, 'teto de 12');

  // Na busca, os que somem liberam espaço.
  await buscar(pagina, 'item 1, item 2');
  assert.equal(await colunas(), 2);
  await buscar(pagina, '');

  await pagina.selectOption('#colunasSelect', '3');
  assert.equal(await colunas(), 3);
  await pagina.selectOption('#colunasSelect', '12');
  assert.equal(await colunas(), 12);

  // Com 12 colunas o cabeçalho do cartão cabe sem estourar a largura.
  const estouro = await pagina.evaluate(() => [...document.querySelectorAll('.cartao-forn')]
    .some((c) => c.scrollWidth > c.clientWidth + 1));
  assert.equal(estouro, false, 'conteúdo do cartão vazando');
  await pagina.screenshot({ path: `${SAIDA}/wtela-12-colunas.png` });

  // No celular continua uma coluna só.
  await pagina.setViewportSize({ width: 390, height: 844 });
  assert.equal(await colunas(), 1);
  assert.deepEqual(erros, []);
  await ctx.close();
});

await caso('celular: sem rolagem lateral, busca presa no topo', async () => {
  const ctx = await navegador.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const { pagina, erros } = await abrir({ contexto: ctx });
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES], ['Apple Import', apple], ['Smartphones', smartphones]]);
  await buscar(pagina, 'iphone');
  const largura = await pagina.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  assert.ok(largura[0] <= largura[1], `rolagem lateral: ${largura}`);
  await pagina.screenshot({ path: `${SAIDA}/wtela-celular-topo.png` });
  await pagina.evaluate(() => window.scrollTo(0, 2200));
  await pagina.waitForTimeout(300);
  const topoBarra = await pagina.evaluate(() => document.getElementById('barraBusca').getBoundingClientRect().top);
  assert.ok(Math.abs(topoBarra) < 2, `barra em ${topoBarra}`);
  await pagina.screenshot({ path: `${SAIDA}/wtela-celular-rolado.png` });
  // Fonte dos campos >= 16px: evita o zoom automático do iOS.
  const fontes = await pagina.evaluate(() => [...document.querySelectorAll('input[type=text], textarea, select')].map((e) => parseFloat(getComputedStyle(e).fontSize)));
  assert.ok(fontes.every((f) => f >= 16), `fontes: ${[...new Set(fontes)]}`);
  assert.deepEqual(erros, []);
  await ctx.close();
});

await caso('desktop: captura para revisão visual', async () => {
  const { pagina, ctx } = await abrir({ largura: 1440 });
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES], ['Apple Import', apple], ['Smartphones', smartphones], ['Vazio', '']]);
  await buscar(pagina, 'iphone', '256');
  await pagina.screenshot({ path: `${SAIDA}/wtela-desktop.png`, fullPage: false });
  await ctx.close();
});

await caso('modo escuro renderiza sem erros', async () => {
  const ctx = await navegador.newContext({ viewport: { width: 1200, height: 900 }, colorScheme: 'dark' });
  const { pagina, erros } = await abrir({ contexto: ctx });
  await preencher(pagina, [['Loja Centro', LOJA_SIMPLES], ['Apple Import', apple]]);
  await buscar(pagina, 'iphone 15');
  await pagina.screenshot({ path: `${SAIDA}/wtela-escuro.png` });
  assert.deepEqual(erros, []);
  await ctx.close();
});

await navegador.close();
console.log(falhas ? `\n${falhas} falha(s)` : `\ntodos passaram · capturas em ${SAIDA}`);
process.exit(falhas ? 1 : 0);

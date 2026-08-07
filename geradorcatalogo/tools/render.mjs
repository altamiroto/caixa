#!/usr/bin/env node
/**
 * Renderizador de catálogos.
 *
 * Lê um arquivo de texto com a(s) lista(s), pagina e exporta um PNG por página
 * em 2160x3840 (9:16, 4K vertical).
 *
 * Uso:
 *   node tools/render.mjs samples/smartphones.txt --tema noite --saida saida/
 *   node tools/render.mjs samples/apple.txt --tema rose --marca "Minha Loja"
 *
 * Opções:
 *   --tema <id>       noite | natal | rose | neon | limpo   (padrão: noite)
 *   --saida <dir>     diretório de destino                   (padrão: ./saida)
 *   --marca <texto>   assinatura no rodapé
 *   --sobretitulo <t> linha acima do título                  (padrão: "Lista de produtos")
 *   --escala-max <n>  teto do ajuste tipográfico             (padrão: 1.15)
 *   --largura <px>    largura final; a altura sai de 16/9    (padrão: 2160)
 *   --html            também grava o HTML de cada página
 *
 * O layout roda dentro do Chromium (é lá que dá para medir texto de verdade).
 * Em vez de empacotar os módulos, servimos o diretório do projeto num host
 * fictício e deixamos o próprio navegador resolver os imports ESM.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

import { parseVarios } from '../src/parser/parse.js';
import { LARGURA, ALTURA } from '../src/render/template.js';
import { TEMA_PADRAO, TEMAS } from '../src/themes/temas.js';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'http://gerador.local';

const TIPOS = {
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
};

function lerArgumentos(argv) {
  const opcoes = {
    entrada: null,
    tema: TEMA_PADRAO,
    saida: join(process.cwd(), 'saida'),
    marca: '',
    sobretitulo: 'Lista de produtos',
    escalaMax: undefined,
    largura: 2160,
    html: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const proximo = () => argv[++i];
    if (a === '--tema') opcoes.tema = proximo();
    else if (a === '--saida') opcoes.saida = proximo();
    else if (a === '--marca') opcoes.marca = proximo();
    else if (a === '--sobretitulo') opcoes.sobretitulo = proximo();
    else if (a === '--escala-max') opcoes.escalaMax = Number(proximo());
    else if (a === '--largura') opcoes.largura = Number(proximo());
    else if (a === '--html') opcoes.html = true;
    else if (a.startsWith('--')) throw new Error(`Opção desconhecida: ${a}`);
    else opcoes.entrada = a;
  }

  if (!opcoes.entrada) throw new Error('Informe o arquivo de entrada.');
  if (!TEMAS[opcoes.tema]) {
    throw new Error(`Tema "${opcoes.tema}" não existe. Use: ${Object.keys(TEMAS).join(', ')}`);
  }
  return opcoes;
}

/**
 * Localiza um Chromium utilizável.
 *
 * `undefined` deixa o Playwright usar o navegador que ele mesmo baixou — é o
 * caminho normal. Em ambientes que já trazem o Chromium instalado (e onde a
 * versão do pacote pode não bater com a do binário), CHROMIUM_PATH ou
 * PLAYWRIGHT_BROWSERS_PATH resolvem sem precisar baixar de novo.
 */
function acharChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;

  const raizes = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!raizes) return undefined;

  for (const nome of readdirSync(raizes).filter((n) => n.startsWith('chromium-')).sort().reverse()) {
    const alvo = join(raizes, nome, 'chrome-linux', 'chrome');
    if (existsSync(alvo)) return alvo;
  }
  return undefined;
}

/** Nome de arquivo seguro a partir do título do catálogo. */
function apelido(texto, indice) {
  const base = String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base || `catalogo-${indice + 1}`;
}

/** Serve os arquivos do projeto para o navegador, sem subir servidor de rede. */
async function montarPalco(pagina) {
  await pagina.route(`${HOST}/**`, async (rota) => {
    const url = new URL(rota.request().url());
    const relativo = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\.]+)/, '');
    const caminho = join(RAIZ, relativo);
    if (!caminho.startsWith(RAIZ)) return rota.abort();
    try {
      const corpo = await readFile(caminho);
      const ext = relativo.slice(relativo.lastIndexOf('.'));
      await rota.fulfill({ body: corpo, contentType: TIPOS[ext] ?? 'application/octet-stream' });
    } catch {
      await rota.fulfill({ status: 404, body: 'não encontrado' });
    }
  });

  await pagina.goto(`${HOST}/tools/palco.html`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForFunction(() => Boolean(window.__gc), null, { timeout: 20000 });
}

async function main() {
  const opcoes = lerArgumentos(process.argv.slice(2));
  const texto = await readFile(opcoes.entrada, 'utf8');
  const catalogos = parseVarios(texto);

  if (!catalogos.length) {
    console.error('Nenhum catálogo reconhecido na entrada.');
    process.exitCode = 1;
    return;
  }

  await mkdir(opcoes.saida, { recursive: true });

  const navegador = await chromium.launch({ executablePath: acharChromium() });
  const contexto = await navegador.newContext({
    viewport: { width: LARGURA, height: ALTURA },
    // 1080 px de projeto -> `largura` px finais.
    deviceScaleFactor: opcoes.largura / LARGURA,
  });
  const pagina = await contexto.newPage();
  await montarPalco(pagina);

  const gerados = [];
  const opcoesLayout = {
    tema: opcoes.tema,
    marca: opcoes.marca,
    sobretitulo: opcoes.sobretitulo,
    escalaMax: opcoes.escalaMax,
  };

  for (const [indice, catalogo] of catalogos.entries()) {
    const nomeBase = apelido(catalogo.titulo, indice);

    const resultado = await pagina.evaluate(
      ([cat, op]) => window.__gc.paginar({ documento: document, janela: window, catalogo: cat, opcoes: op }),
      [catalogo, opcoesLayout],
    );

    for (const [i, p] of resultado.paginas.entries()) {
      const sufixo = resultado.paginas.length > 1 ? `-${String(i + 1).padStart(2, '0')}` : '';
      const arquivo = join(opcoes.saida, `${nomeBase}${sufixo}.png`);

      await pagina.evaluate((h) => {
        document.querySelector('#palco').innerHTML = h;
        return document.fonts.ready;
      }, p.html);

      const alvo = await pagina.$('#palco .pagina');
      await alvo.screenshot({ path: arquivo, scale: 'device' });
      gerados.push(arquivo);

      if (opcoes.html) {
        await writeFile(
          arquivo.replace(/\.png$/, '.html'),
          `<!doctype html><meta charset="utf-8">` +
            `<link rel="stylesheet" href="../src/render/catalogo.css">${p.html}`,
          'utf8',
        );
      }
    }

    const avisos = catalogo.avisos.filter((a) => a.nivel !== 'info');
    console.log(
      `${catalogo.titulo || '(sem título)'} — ${catalogo.resumo.totalProdutos} produtos, ` +
        `${resultado.paginas.length} página(s), escala ${resultado.escala.toFixed(3)}` +
        (avisos.length ? `, ${avisos.length} aviso(s)` : ''),
    );
    for (const a of avisos) console.log(`   [${a.nivel}] linha ${a.linha ?? '?'}: ${a.mensagem}`);
  }

  await navegador.close();

  console.log(`\n${gerados.length} imagem(ns) em ${opcoes.saida}`);
  console.log(`Resolução: ${opcoes.largura}x${Math.round((opcoes.largura * ALTURA) / LARGURA)} (9:16)`);
}

main().catch((erro) => {
  console.error(`Erro: ${erro.message}`);
  process.exitCode = 1;
});

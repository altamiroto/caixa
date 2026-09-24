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
 * Vários arquivos de uma vez, cada um virando a sua imagem:
 *   node tools/render.mjs samples/*.txt --tema aleatorio
 *
 * Opções:
 *   --tema <id>       121 temas; veja o README                (padrão: noite)
 *                     use `aleatorio` para sortear um tema inédito a cada run
 *   --semente <n>     torna o sorteio reproduzível
 *   --saida <dir>     diretório de destino                   (padrão: ./saida)
 *   --marca <texto>   assinatura no rodapé
 *   --sobretitulo <t> linha acima do título; vazio esconde  (padrão: "Lista de produtos")
 *   --titulo <texto>  substitui o título lido da lista
 *   --data <texto>    substitui a data lida da lista
 *   --sem-data        esconde a data
 *   --sem-subtitulo   esconde a linha de marcas
 *   --selo <texto>    destaca o lançamento como cápsula com esse texto;
 *                     sem a opção, a palavra sai como você escreveu
 *   --escala-max <n>  teto do ajuste tipográfico             (padrão: 1.15)
 *   --fundo-imagem <arquivo>  foto de fundo da página (jpg/png/webp)
 *   --veu <css>       cor/gradiente por cima da foto; o tema define um padrão
 *   --paginas-max <n> teto de páginas por catálogo            (padrão: 1)
 *   --layout <t>      tabela | grade | vitrine | duplo        (padrão: tabela)
 *                     os três últimos põem dois produtos por linha
 *   --remover <lista> palavras a tirar do nome, separadas por vírgula
 *                     ex.: --remover "Smart TV,LANÇAMENTO"
 *   --alinhar-nome  <esquerda|centro|direita>  (padrão: esquerda)
 *   --alinhar-cor   <esquerda|centro|direita>  (padrão: centro)
 *   --alinhar-preco <esquerda|centro|direita>  (padrão: centro)
 *   --margens <padrao|stories>  preset de margem; `stories` reserva a área
 *                     que Instagram e WhatsApp cobrem com a interface
 *   --margem-topo <px> / --margem-lateral <px> / --margem-base <px>
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
import { LARGURA, ALTURA, ALINHAMENTOS, MARGENS, LAYOUTS } from '../src/render/template.js';
import { TEMA_PADRAO, TEMAS, sortearTema } from '../src/themes/temas.js';

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
    entradas: [],
    tema: TEMA_PADRAO,
    saida: join(process.cwd(), 'saida'),
    marca: '',
    sobretitulo: 'Lista de produtos',
    titulo: undefined,
    data: undefined,
    mostrarData: true,
    mostrarSubtitulo: true,
    selo: undefined,
    escalaMax: undefined,
    fundoImagem: undefined,
    veu: undefined,
    paginasMax: undefined,
    layout: undefined,
    remover: '',
    alinhar: {},
    margens: {},
    semente: undefined,
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
    else if (a === '--titulo') opcoes.titulo = proximo();
    else if (a === '--data') opcoes.data = proximo();
    else if (a === '--sem-data') opcoes.mostrarData = false;
    else if (a === '--sem-subtitulo') opcoes.mostrarSubtitulo = false;
    else if (a === '--selo') opcoes.selo = proximo();
    else if (a === '--escala-max') opcoes.escalaMax = Number(proximo());
    else if (a === '--fundo-imagem') opcoes.fundoImagem = proximo();
    else if (a === '--veu') opcoes.veu = proximo();
    else if (a === '--paginas-max') opcoes.paginasMax = Number(proximo());
    else if (a === '--layout') opcoes.layout = proximo();
    else if (a === '--remover') opcoes.remover = proximo();
    else if (a === '--alinhar-nome') opcoes.alinhar.nome = proximo();
    else if (a === '--alinhar-cor') opcoes.alinhar.cor = proximo();
    else if (a === '--alinhar-preco') opcoes.alinhar.preco = proximo();
    else if (a === '--margens') opcoes.margens.preset = proximo();
    else if (a === '--margem-topo') opcoes.margens.topo = Number(proximo());
    else if (a === '--margem-lateral') opcoes.margens.lateral = Number(proximo());
    else if (a === '--margem-base') opcoes.margens.base = Number(proximo());
    else if (a === '--semente') opcoes.semente = Number(proximo());
    else if (a === '--largura') opcoes.largura = Number(proximo());
    else if (a === '--html') opcoes.html = true;
    else if (a.startsWith('--')) throw new Error(`Opção desconhecida: ${a}`);
    else opcoes.entradas.push(a);
  }

  if (!opcoes.entradas.length) throw new Error('Informe ao menos um arquivo de entrada.');
  if (opcoes.tema !== 'aleatorio' && !TEMAS[opcoes.tema]) {
    const amostra = Object.keys(TEMAS).slice(0, 8).join(', ');
    throw new Error(
      `Tema "${opcoes.tema}" não existe. São ${Object.keys(TEMAS).length} temas ` +
        `(ex.: ${amostra}...) — ou use "aleatorio".`,
    );
  }
  // Avisa em vez de aceitar calado: um valor errado viraria o padrão silencioso.
  for (const [coluna, valor] of Object.entries(opcoes.alinhar)) {
    if (!ALINHAMENTOS.includes(valor)) {
      throw new Error(`Alinhamento "${valor}" (${coluna}) inválido. Use: ${ALINHAMENTOS.join(', ')}`);
    }
  }
  if (opcoes.layout && !LAYOUTS.includes(opcoes.layout)) {
    throw new Error(`Layout "${opcoes.layout}" não existe. Use: ${LAYOUTS.join(', ')}`);
  }
  if (opcoes.margens.preset && !MARGENS[opcoes.margens.preset]) {
    throw new Error(`Margem "${opcoes.margens.preset}" não existe. Use: ${Object.keys(MARGENS).join(', ')}`);
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

const MIMES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

/** Lê uma imagem do disco e devolve como data URI, para embutir na página. */
async function comoDataUri(caminho) {
  const ext = caminho.slice(caminho.lastIndexOf('.')).toLowerCase();
  const mime = MIMES[ext];
  if (!mime) throw new Error(`Formato de imagem não suportado: ${ext || caminho}`);
  const dados = await readFile(caminho);
  return `data:${mime};base64,${dados.toString('base64')}`;
}

/**
 * Garante nome de arquivo único.
 *
 * Duas listas podem ter o mesmo título — mandar a mesma lista duas vezes, ou
 * duas datas do mesmo produto. Sem isso, a segunda sobrescrevia a primeira em
 * silêncio e o lote saía com uma imagem a menos.
 */
function semRepetir(base, usados) {
  if (!usados.has(base)) {
    usados.add(base);
    return base;
  }
  for (let n = 2; ; n += 1) {
    const tentativa = `${base}-${n}`;
    if (!usados.has(tentativa)) {
      usados.add(tentativa);
      return tentativa;
    }
  }
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

  // Cada arquivo é lido em separado, e um arquivo ainda pode trazer várias
  // mensagens coladas — as duas formas de agrupar se somam.
  const catalogos = [];
  for (const arquivo of opcoes.entradas) {
    catalogos.push(...parseVarios(await readFile(arquivo, 'utf8')));
  }

  if (!catalogos.length) {
    console.error('Nenhum catálogo reconhecido nas entradas.');
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

  // Sorteio: sem semente, o contador vem do relógio, então cada execução do dia
  // sai com cor claramente diferente da anterior.
  const contadorBase = Number.isFinite(opcoes.semente)
    ? opcoes.semente
    : Math.floor(Date.now() / 1000);

  const gerados = [];
  const nomesUsados = new Set();
  const opcoesLayout = {
    tema: opcoes.tema,
    marca: opcoes.marca,
    sobretitulo: opcoes.sobretitulo,
    titulo: opcoes.titulo,
    data: opcoes.data,
    mostrarData: opcoes.mostrarData,
    mostrarSubtitulo: opcoes.mostrarSubtitulo,
    selo: opcoes.selo,
    escalaMax: opcoes.escalaMax,
    paginasMax: opcoes.paginasMax,
    veu: opcoes.veu,
    layout: opcoes.layout,
    remover: opcoes.remover,
    alinhar: opcoes.alinhar,
    margens: opcoes.margens,
    // A foto vai embutida em base64: o navegador não tem acesso ao disco.
    fundoImagem: opcoes.fundoImagem ? await comoDataUri(opcoes.fundoImagem) : undefined,
  };

  for (const [indice, catalogo] of catalogos.entries()) {
    const nomeBase = semRepetir(apelido(catalogo.titulo, indice), nomesUsados);

    // Com o sorteio ligado, cada catálogo ganha o seu tema: cada imagem vai
    // para um post diferente, e sair tudo da mesma cor anularia o sorteio.
    // O objeto inteiro, não o id: ver obterTema em src/themes/temas.js.
    const opcoesDoCatalogo = { ...opcoesLayout };
    let sorteado = null;
    if (opcoes.tema === 'aleatorio') {
      sorteado = sortearTema({ contador: contadorBase + indice });
      opcoesDoCatalogo.tema = sorteado;
    }

    const resultado = await pagina.evaluate(
      ([cat, op]) => window.__gc.paginar({ documento: document, janela: window, catalogo: cat, opcoes: op }),
      [catalogo, opcoesDoCatalogo],
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
        (sorteado ? `, tema ${sorteado.nome}` : '') +
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

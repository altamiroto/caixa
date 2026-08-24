/**
 * Exportação para PNG no navegador.
 *
 * Sem dependências: a página é embrulhada num `<foreignObject>` de SVG e
 * desenhada num canvas do tamanho final. É o mesmo truque que as bibliotecas
 * de "html para imagem" usam por dentro.
 *
 * Limitação conhecida: o SVG não enxerga recursos externos, então tudo precisa
 * estar embutido — por isso o CSS é copiado inteiro para dentro. Emojis
 * dependem da fonte do sistema e podem sair diferentes; o caminho exato para
 * publicação é `tools/render.mjs`, que fotografa o Chromium de verdade.
 *
 * Boa parte do cuidado aqui é com celular. Um PNG 2160x3840 ocupa ~33 MB de
 * canvas, e o iOS descarta canvas grande sem avisar quando a memória aperta —
 * era o que fazia o segundo download não sair sem recarregar a página.
 */

import { LARGURA, ALTURA } from './template.js';

/** Lê todas as regras CSS já carregadas na página, para embutir no SVG. */
function coletarCss(documento) {
  const partes = [];
  for (const folha of documento.styleSheets) {
    try {
      for (const regra of folha.cssRules) partes.push(regra.cssText);
    } catch {
      // Folha de outra origem: não dá para ler, e não usamos nenhuma.
    }
  }
  return partes.join('\n');
}

/**
 * Converte um elemento `.pagina` em PNG.
 *
 * @param {HTMLElement} elemento
 * @param {Object} [opcoes]
 * @param {number} [opcoes.largura] Largura final em px (padrão 2160 = 4K vertical)
 * @returns {Promise<Blob>}
 */
export async function paraPng(elemento, { largura = 2160 } = {}) {
  const documento = elemento.ownerDocument;
  const altura = Math.round((largura * ALTURA) / LARGURA);

  const clone = elemento.cloneNode(true);
  clone.style.margin = '0';

  const css = coletarCss(documento);
  const conteudo = new XMLSerializer().serializeToString(clone);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGURA}" height="${ALTURA}">
    <foreignObject width="100%" height="100%">
      <div xmlns="http://www.w3.org/1999/xhtml">
        <style>${css}</style>
        ${conteudo}
      </div>
    </foreignObject>
  </svg>`;

  // Precisa ser data: URL — um blob: URL conta como origem externa e o canvas
  // fica "tainted", o que impede toBlob().
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

  const imagem = await carregarImagem(url);
  const canvas = documento.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;

  try {
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imagem, 0, 0, largura, altura);

    return await new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error('O navegador não conseguiu gerar o PNG — provável falta de memória.'));
      }, 'image/png');
    });
  } finally {
    /*
     * Zerar as dimensões devolve os ~33 MB na hora. Sem isso o canvas só sai
     * quando o coletor de lixo resolve passar, e no celular a segunda
     * exportação encontrava a memória ainda ocupada pela primeira.
     */
    canvas.width = 0;
    canvas.height = 0;
  }
}

function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('O navegador não conseguiu rasterizar a página.'));
    img.src = url;
  });
}

/*
 * URLs de blob vivos. Revogar por temporizador curto era um jogo de sorte: no
 * celular o download demora mais que o prazo, e o arquivo chegava vazio. Aqui
 * cada URL só é revogado quando o próximo é criado, então o que está em uso
 * nunca é puxado debaixo do download.
 */
const urlsVivos = new Set();

function criarUrl(blob) {
  for (const antigo of urlsVivos) URL.revokeObjectURL(antigo);
  urlsVivos.clear();
  const url = URL.createObjectURL(blob);
  urlsVivos.add(url);
  return url;
}

/** O aparelho consegue abrir a folha de compartilhamento com arquivo? */
export function podeCompartilhar(blob, nome) {
  if (typeof navigator === 'undefined' || !navigator.canShare || !navigator.share) return false;
  try {
    return navigator.canShare({ files: [new File([blob], nome, { type: 'image/png' })] });
  } catch {
    return false;
  }
}

/**
 * Entrega a imagem ao usuário.
 *
 * No celular, `<a download>` é pouco confiável — o iOS costuma abrir o arquivo
 * numa aba em vez de salvar, e ao voltar a página fica num estado em que o
 * próximo download não acontece. A folha de compartilhamento nativa resolve
 * isso e ainda cai melhor no uso real: dá para mandar direto para o WhatsApp
 * ou salvar em Fotos, sem passar pela pasta de downloads.
 *
 * @returns {Promise<'compartilhado'|'baixado'|'cancelado'>}
 */
export async function salvarImagem(blob, nome) {
  if (podeCompartilhar(blob, nome)) {
    try {
      await navigator.share({ files: [new File([blob], nome, { type: 'image/png' })] });
      return 'compartilhado';
    } catch (erro) {
      // Cancelar não é falha: o usuário fechou a folha de propósito.
      if (erro?.name === 'AbortError') return 'cancelado';
      // Qualquer outro motivo (gesto expirado, permissão) cai no download.
    }
  }
  baixar(blob, nome);
  return 'baixado';
}

/** Dispara o download de um blob com o nome informado. */
export function baixar(blob, nome) {
  const url = criarUrl(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/** Nome de arquivo seguro a partir de um texto livre. */
export function apelido(texto, alternativa = 'catalogo') {
  const base = String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return base || alternativa;
}

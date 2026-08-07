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
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imagem, 0, 0, largura, altura);
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar o PNG.'))), 'image/png');
  });
}

function carregarImagem(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('O navegador não conseguiu rasterizar a página.'));
    img.src = url;
  });
}

/** Dispara o download de um blob com o nome informado. */
export function baixar(blob, nome) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

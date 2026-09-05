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
 * URLs de blob vivos.
 *
 * Revogar por temporizador curto era um jogo de sorte: no celular o download
 * demora mais que o prazo e o arquivo chegava vazio. Revogar quando o próximo
 * era criado tinha o mesmo defeito com outra roupa — salvar a segunda imagem
 * puxava o tapete da primeira, que ainda podia estar baixando.
 *
 * Agora nada é revogado enquanto as prévias estão na tela. Cada URL é só um
 * ponteiro para um blob que já existe na memória; o custo real é o blob, e ele
 * é liberado junto com as prévias, em `liberarUrls`.
 */
const urlsVivos = new Set();

function criarUrl(blob) {
  const url = URL.createObjectURL(blob);
  urlsVivos.add(url);
  return url;
}

/** Revoga tudo. Chamar ao trocar as prévias, não entre um download e outro. */
export function liberarUrls() {
  for (const url of urlsVivos) URL.revokeObjectURL(url);
  urlsVivos.clear();
}

/*
 * Salvar é sempre download direto.
 *
 * Chegou a existir aqui um desvio para a folha de compartilhamento nativa
 * (`navigator.share`), como contorno para o travamento do segundo download no
 * celular. O travamento era de memória — canvas e blob URL segurados tempo
 * demais, corrigidos acima — e a folha de compartilhamento só atrapalhava:
 * botão de compartilhar num lugar onde se espera salvar.
 */

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

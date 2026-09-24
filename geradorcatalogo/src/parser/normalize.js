/**
 * Limpeza do texto cru do WhatsApp.
 *
 * A formatação do WhatsApp (*negrito*, _itálico_, `mono`, ~riscado~) carrega
 * informação útil: nome de produto e título de seção quase sempre vêm em
 * negrito. Por isso não jogamos fora — registramos onde estava a ênfase antes
 * de remover os marcadores.
 */

/** Faixa de emojis/símbolos. Usada só para extrair o prefixo decorativo. */
const EMOJI =
  /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{00A9}\u{00AE}\u{2122}]/u;
const EMOJI_PREFIXO =
  /^(?:[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{00A9}\u{00AE}\u{2122}\u{200D}]|\s)+/u;
const EMOJI_SUFIXO =
  /(?:[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{20E3}\u{00A9}\u{00AE}\u{2122}\u{200D}]|\s)+$/u;

/** Normaliza espaços exóticos e quebras, sem alterar o conteúdo textual. */
export function normalizarEspacos(texto) {
  return texto
    .replace(/\r\n?/g, '\n')
    .replace(/[  -   　]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Remove acentos e caixa, para comparações tolerantes. */
export function chave(texto) {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Tira os marcadores do WhatsApp e diz o que estava enfatizado.
 *
 * Os marcadores aparecem aninhados na prática (`_*`REALME`*_`), então
 * descascamos em camadas até não sobrar nenhum.
 *
 * `destaque` devolve o conteúdo do primeiro trecho em negrito já limpo. Ele é
 * o sinal mais forte que a lista dá: é ali que está o nome do produto, e o que
 * vem depois costuma ser complemento ("Tela 11 pol.") ou cor.
 *
 * @returns {{texto: string, destaque: string, negrito: boolean, italico: boolean, mono: boolean}}
 */
export function removerMarcacao(linha) {
  let texto = linha;
  let negrito = false;
  let italico = false;
  let mono = false;

  const spanNegrito = linha.match(/\*([^*]+)\*/);

  // Detecta a ênfase antes de descascar: basta um par presente na linha.
  if (/\*[^*]+\*/.test(texto)) negrito = true;
  if (/(?:^|\s|\*)_[^_]+_(?:$|\s|\*)/.test(texto)) italico = true;
  if (/`[^`]+`/.test(texto)) mono = true;

  // Descasca em camadas — cada passada remove um nível de aninhamento.
  for (let i = 0; i < 6; i += 1) {
    const antes = texto;
    texto = texto
      .replace(/\*([^*]*)\*/g, '$1')
      .replace(/`([^`]*)`/g, '$1')
      .replace(/~([^~]*)~/g, '$1');
    // Itálico só quando `_` delimita palavra — nomes como `82VY000SBR_x` ficam intactos.
    texto = texto.replace(/(^|[\s*`(])_([^_\n]+)_(?=$|[\s*`,.:;)])/g, '$1$2');
    if (texto === antes) break;
  }

  // Marcadores órfãos (o usuário fecha o negrito no lugar errado às vezes).
  texto = texto.replace(/[*`~]/g, '');

  const destaque = spanNegrito ? limparMarcadores(spanNegrito[1]) : '';

  return { texto: normalizarEspacos(texto), destaque, negrito, italico, mono };
}

/** Descasca marcadores sem interpretar ênfase. Usado no conteúdo do negrito. */
function limparMarcadores(texto) {
  let s = texto;
  for (let i = 0; i < 4; i += 1) {
    const antes = s;
    s = s.replace(/`([^`]*)`/g, '$1').replace(/~([^~]*)~/g, '$1');
    s = s.replace(/(^|[\s`(])_([^_\n]+)_(?=$|[\s`,.:;)])/g, '$1$2');
    if (s === antes) break;
  }
  return normalizarEspacos(s.replace(/[*`~]/g, ''));
}

/** Separa o emoji decorativo do início da linha do resto do conteúdo. */
export function separarEmoji(texto) {
  const m = texto.match(EMOJI_PREFIXO);
  if (!m) return { emoji: '', resto: texto.trim() };
  const emoji = m[0].replace(/\s+/g, '');
  const resto = texto.slice(m[0].length).trim();
  // Um prefixo só de espaços não conta como emoji.
  if (!emoji) return { emoji: '', resto: texto.trim() };
  return { emoji, resto };
}

/** Tira emojis decorativos do fim (ex.: `📢📢 TÍTULO 📢📢`). */
export function tirarEmojiFinal(texto) {
  const semFim = texto.replace(EMOJI_SUFIXO, '');
  return semFim.trim() || texto.trim();
}

export function temEmoji(texto) {
  return EMOJI.test(texto);
}

/**
 * Quebra a entrada em blocos separados por linha em branco, preservando o
 * número da linha original de cada trecho (para mensagens de aviso úteis).
 *
 * @returns {{linhas: {texto: string, n: number}[]}[]}
 */
export function emBlocos(entrada) {
  const linhas = entrada.replace(/\r\n?/g, '\n').split('\n');
  const blocos = [];
  let atual = [];

  const fechar = () => {
    if (atual.length) blocos.push({ linhas: atual });
    atual = [];
  };

  linhas.forEach((bruta, i) => {
    const texto = normalizarEspacos(bruta);
    if (!texto) {
      fechar();
      return;
    }
    atual.push({ texto, n: i + 1, bruta });
  });
  fechar();
  return blocos;
}

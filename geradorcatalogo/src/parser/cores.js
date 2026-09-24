/**
 * Reconhecimento de cor.
 *
 * A cor aparece em três lugares diferentes nas listas:
 *   - depois do negrito:  *Realme C71 4/128gb* - Branco
 *   - dentro do negrito:  *iPhone 16 128gb - Rosa*
 *   - combinada:          - Preto/Azul/Verde
 *
 * Não dá para assumir que tudo depois de " - " é cor: também aparece
 * "- 180w RMS Bluetooth" e "- 30ml". Por isso usamos um léxico: a cauda só
 * vira cor se cada item separado por "/" contiver uma palavra conhecida.
 */

import { chave } from './normalize.js';

const PALAVRAS = [
  'preto', 'preta', 'branco', 'branca', 'azul', 'verde', 'vermelho', 'vermelha',
  'rosa', 'roxo', 'roxa', 'lilas', 'violeta', 'cinza', 'grafite', 'chumbo',
  'dourado', 'dourada', 'ouro', 'prata', 'prateado', 'prateada', 'bronze',
  'amarelo', 'amarela', 'laranja', 'marrom', 'bege', 'creme', 'gelo', 'nude',
  'titanium', 'titanio', 'natural', 'desert', 'storm', 'camuflada', 'camuflado',
  'grafita', 'silver', 'black', 'blue', 'white', 'midnight', 'starlight',
  'claro', 'clara', 'escuro', 'escura', 'inox',
];

const CONJUNTO = new Set(PALAVRAS);

/** A palavra isolada é um nome de cor? */
export function ehPalavraDeCor(palavra) {
  return CONJUNTO.has(chave(palavra));
}

/**
 * O trecho descreve cor(es)?
 *
 * Aceita "Azul Claro", "Storm Titanium", "Preto/Azul/Verde"; rejeita
 * "180w RMS Bluetooth" e "Tela 11 pol. 4G".
 */
export function ehTrechoDeCor(trecho) {
  const t = trecho.trim();
  if (!t || t.length > 60) return false;
  if (/\d/.test(t) && !/^\d+\s*(?:gb|tb)$/i.test(t)) {
    // Números quase sempre indicam especificação, não cor.
    if (!/^[^\d]*$/.test(t)) return false;
  }
  const itens = t.split('/').map((s) => s.trim()).filter(Boolean);
  if (!itens.length) return false;
  return itens.every((item) => {
    const palavras = item.split(/\s+/);
    if (palavras.length > 3) return false;
    return palavras.some(ehPalavraDeCor);
  });
}

/** "Preto/Azul Claro" -> ["Preto", "Azul Claro"] */
export function separarCores(trecho) {
  return trecho
    .split(/[/,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.replace(/\s+/g, ' '));
}

/**
 * Tira a cor de um texto, em qualquer posição depois do primeiro segmento.
 *
 * O texto é quebrado em " - " (traço cercado de espaço, para não estraçalhar
 * códigos como "AWS-BBS-01-B") e cada segmento a partir do segundo é testado.
 * Assim "JBL Boombox 3 - Preta - 180w RMS" devolve a cor do meio e mantém a
 * especificação no nome.
 *
 * @returns {{texto: string, cores: string[]}}
 */
export function extrairCores(texto) {
  const partes = texto.split(/\s+[-–—]\s+/);
  if (partes.length < 2) return { texto: texto.trim(), cores: [] };

  const cores = [];
  const mantidos = [partes[0]];
  for (const parte of partes.slice(1)) {
    if (ehTrechoDeCor(parte)) cores.push(...separarCores(parte));
    else mantidos.push(parte);
  }
  if (!cores.length) return { texto: texto.trim(), cores: [] };
  return { texto: mantidos.join(' - ').trim(), cores };
}


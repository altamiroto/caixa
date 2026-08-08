/**
 * Remoção de palavras do nome do produto.
 *
 * Serve para tirar o que se repete em toda linha e o título já diz: numa lista
 * de TVs, "Smart TV" aparece 14 vezes; nos carregadores, "Tomada/Carregador"
 * aparece 6. Some com isso e o nome fica mais curto, o que também dá mais
 * espaço para a tabela caber.
 *
 * A remoção é de apresentação, não de leitura: o modelo continua guardando o
 * nome completo. Trocar a lista de palavras não exige reprocessar nada.
 */

/**
 * Versão sem acento e em minúsculas, com mapa de volta para os índices do
 * texto original.
 *
 * Comparar direto não funciona: o usuário digita "lancamento" e a lista traz
 * "LANÇAMENTO". Comparar na forma normalizada resolve, mas aí é preciso saber
 * onde cortar no texto de verdade — daí o mapa.
 */
function normalizarComMapa(texto) {
  const saida = [];
  const mapa = [];
  for (let i = 0; i < texto.length; i += 1) {
    const base = texto[i].normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const c of base) {
      saida.push(c.toLowerCase());
      mapa.push(i);
    }
  }
  return { normalizado: saida.join(''), mapa };
}

const ESPECIAIS = /[.*+?^${}()|[\]\\]/g;

/**
 * Monta o regex de um termo. Aceita frase ("Smart TV") e é tolerante ao
 * espaçamento entre as palavras.
 */
function regexDoTermo(termo) {
  const { normalizado } = normalizarComMapa(termo.trim());
  if (!normalizado) return null;
  const partes = normalizado.split(/\s+/).map((p) => p.replace(ESPECIAIS, '\\$&'));
  // \b nas pontas evita que "TV" coma o "TV" de dentro de outra palavra.
  return new RegExp(`\\b${partes.join('\\s+')}\\b`, 'g');
}

/** Aceita array ou string separada por vírgula/quebra de linha. */
export function listaDeTermos(entrada) {
  if (!entrada) return [];
  const bruto = Array.isArray(entrada) ? entrada : String(entrada).split(/[,\n]/);
  return bruto.map((t) => String(t).trim()).filter(Boolean);
}

/**
 * Tira os termos do texto e arruma o que sobrou.
 *
 * @param {string} texto
 * @param {string[]|string} termos
 * @returns {string}
 */
export function removerTermos(texto, termos) {
  const lista = listaDeTermos(termos);
  if (!lista.length || !texto) return texto;

  const { normalizado, mapa } = normalizarComMapa(texto);

  // Junta as faixas a remover, em índices do texto original.
  const faixas = [];
  for (const termo of lista) {
    const re = regexDoTermo(termo);
    if (!re) continue;
    let m;
    while ((m = re.exec(normalizado)) !== null) {
      if (!m[0].length) break;
      const inicio = mapa[m.index];
      const fim = mapa[m.index + m[0].length - 1] + 1;
      faixas.push([inicio, fim]);
    }
  }
  if (!faixas.length) return texto;

  // Remove de trás para frente para os índices não escorregarem.
  faixas.sort((a, b) => b[0] - a[0]);
  let saida = texto;
  let ultimoInicio = Number.POSITIVE_INFINITY;
  for (const [inicio, fim] of faixas) {
    if (fim > ultimoInicio) continue; // faixas sobrepostas: mantém a primeira
    saida = saida.slice(0, inicio) + saida.slice(fim);
    ultimoInicio = inicio;
  }

  return arrumar(saida);
}

/**
 * Costura o texto depois do recorte: espaço duplo, separador solto no começo
 * ou no fim, parêntese vazio.
 */
function arrumar(texto) {
  return texto
    .replace(/\(\s*\)/g, '')
    // Recorte no meio deixa dois separadores colados: "A - - B".
    .replace(/([-–—,;:])\s*\1+/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;:.])/g, '$1')
    .replace(/^[\s\-–—,;:/]+/, '')
    .replace(/[\s\-–—,;:/]+$/, '')
    .trim();
}

/**
 * Gerador de paletas.
 *
 * Escrever cem temas à mão daria cem chances de errar contraste. Aqui a paleta
 * é *construída*: as cores de fundo saem de uma receita por família, e cada
 * tinta é calculada com `tintaSobre`, que caminha a luminosidade até fechar a
 * razão de contraste exigida. Um tema gerado nasce legível — o teste de
 * contraste só confirma.
 *
 * Três eixos de variação:
 *   - matiz (0-360), que dá a cor;
 *   - família, que dá o clima (escuro, claro, clássico, vibrante);
 *   - estilo, que dá a forma da linha (cápsula, plano, contorno, bloco).
 */

import {
  hsl,
  hslParaRgb,
  compor,
  tintaSobre,
  luminancia,
  luminosidadeDeFundo,
} from './cor.js';

/*
 * Alvos um pouco acima do que o teste cobra (4.5 e 3.0). A folga absorve o
 * arredondamento da conversão e evita paleta que passa raspando.
 */
const FORTE = 5.0;
const SUAVE = 3.4;

export const FAMILIAS = ['escuro', 'claro', 'classico', 'vibrante'];
export const ESTILOS = ['capsula', 'plano', 'contorno', 'bloco'];

/** Forma da linha. Não mexe em cor — só em raio, preenchimento e borda. */
const RECEITA_ESTILO = {
  capsula: { raio: 1.7, alfaA: 0.1, alfaB: 0.04, borda: 0.08, deltaClaro: 6 },
  plano: { raio: 0.2, alfaA: 0.085, alfaB: 0.03, borda: 0.14, deltaClaro: 5 },
  contorno: { raio: 1.0, alfaA: 0.035, alfaB: 0.015, borda: 0.34, deltaClaro: 2 },
  bloco: { raio: 0.45, alfaA: 0.13, alfaB: 0.055, borda: 0.05, deltaClaro: 8 },
};

/** Nomes de matiz em português, para o tema ter rótulo legível. */
const NOMES_MATIZ = [
  [0, 'Vermelho'], [18, 'Coral'], [32, 'Laranja'], [45, 'Âmbar'], [55, 'Dourado'],
  [65, 'Amarelo'], [82, 'Lima'], [100, 'Verde-limão'], [120, 'Verde'], [145, 'Esmeralda'],
  [165, 'Turquesa'], [182, 'Ciano'], [196, 'Azul-piscina'], [210, 'Azul-céu'],
  [224, 'Azul'], [240, 'Anil'], [255, 'Índigo'], [270, 'Violeta'], [285, 'Roxo'],
  [303, 'Púrpura'], [318, 'Magenta'], [332, 'Rosa'], [345, 'Framboesa'], [355, 'Carmim'],
];

const NOME_FAMILIA = {
  escuro: 'escuro',
  claro: 'claro',
  classico: 'clássico',
  vibrante: 'vibrante',
};

export function nomeDaMatiz(h) {
  const matiz = ((h % 360) + 360) % 360;
  let melhor = NOMES_MATIZ[0];
  let menor = 360;
  for (const entrada of NOMES_MATIZ) {
    const d = Math.min(Math.abs(matiz - entrada[0]), 360 - Math.abs(matiz - entrada[0]));
    if (d < menor) {
      menor = d;
      melhor = entrada;
    }
  }
  return melhor[1];
}

/** Fundo, linhas e acento de cada família. O resto é derivado disso. */
function receitaFamilia(familia, h, estilo) {
  const e = RECEITA_ESTILO[estilo];

  if (familia === 'claro') {
    const fundo = `linear-gradient(165deg, ${hsl(h, 55, 97)} 0%, ${hsl(h, 45, 93)} 55%, ${hsl(h, 50, 96)} 100%)`;
    return {
      fundo,
      // A parada mais escura é a que aperta o texto escuro.
      base: hslParaRgb(h, 45, 93),
      linhaA: hsl(h, 40, 99),
      linhaB: hsl(h, 34, 100 - e.deltaClaro - 1),
      borda: `rgba(0,0,0,${(e.borda * 0.55).toFixed(3)})`,
      acento: (h + 8) % 360,
      escura: false,
      brilho: `radial-gradient(circle at 86% 10%, ${hsl(h, 70, 60)}22, transparent 52%)`,
      veu: 'linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.84) 50%, rgba(255,255,255,.94) 100%)',
    };
  }

  if (familia === 'classico') {
    // Fundo profundo e pouco saturado, com acento metálico dourado — a
    // combinação que os temas clássicos curados já usavam.
    const fundo = `linear-gradient(170deg, ${hsl(h, 32, 11)} 0%, ${hsl(h, 34, 18)} 50%, ${hsl(h, 30, 9)} 100%)`;
    return {
      fundo,
      base: hslParaRgb(h, 34, 18),
      linhaA: `rgba(255,255,255,${e.alfaA.toFixed(3)})`,
      linhaB: `rgba(255,255,255,${e.alfaB.toFixed(3)})`,
      borda: `rgba(212,175,55,${(e.borda * 1.6).toFixed(3)})`,
      acento: 43,
      escura: true,
      brilho: `radial-gradient(circle at 78% 12%, rgba(212,175,55,.14), transparent 52%)`,
      veu: 'linear-gradient(180deg, rgba(8,8,12,.88) 0%, rgba(8,8,12,.76) 50%, rgba(8,8,12,.92) 100%)',
    };
  }

  if (familia === 'vibrante') {
    const fundo = `linear-gradient(160deg, ${hsl(h, 62, 13)} 0%, ${hsl(h, 58, 22)} 50%, ${hsl(h, 65, 11)} 100%)`;
    return {
      fundo,
      base: hslParaRgb(h, 58, 22),
      linhaA: `rgba(255,255,255,${e.alfaA.toFixed(3)})`,
      linhaB: `rgba(255,255,255,${e.alfaB.toFixed(3)})`,
      borda: `rgba(255,255,255,${(e.borda * 1.3).toFixed(3)})`,
      acento: (h + 165) % 360,
      escura: true,
      brilho: `radial-gradient(circle at 22% 84%, ${hsl((h + 165) % 360, 80, 55)}33, transparent 55%)`,
      veu: 'linear-gradient(180deg, rgba(6,8,16,.88) 0%, rgba(6,8,16,.76) 50%, rgba(6,8,16,.92) 100%)',
    };
  }

  // escuro (padrão)
  const fundo = `linear-gradient(165deg, ${hsl(h, 44, 10)} 0%, ${hsl(h + 14, 40, 18)} 50%, ${hsl(h, 46, 8)} 100%)`;
  return {
    fundo,
    base: hslParaRgb(h + 14, 40, 18),
    linhaA: `rgba(255,255,255,${e.alfaA.toFixed(3)})`,
    linhaB: `rgba(255,255,255,${e.alfaB.toFixed(3)})`,
    borda: `rgba(255,255,255,${e.borda.toFixed(3)})`,
    acento: (h + 22) % 360,
    escura: true,
    brilho: `radial-gradient(circle at 80% 10%, ${hsl((h + 22) % 360, 85, 60)}2e, transparent 55%)`,
    veu: 'linear-gradient(180deg, rgba(6,10,20,.88) 0%, rgba(6,10,20,.76) 50%, rgba(6,10,20,.92) 100%)',
  };
}

function comoRgb(valor, base) {
  if (typeof valor === 'string' && valor.startsWith('rgba')) {
    const [r, g, b, a] = valor
      .slice(valor.indexOf('(') + 1, valor.lastIndexOf(')'))
      .split(/[,\s/]+/)
      .filter(Boolean)
      .map(Number);
    return compor({ r, g, b, a }, base);
  }
  if (typeof valor === 'string' && valor.startsWith('#')) {
    const h = valor.slice(1);
    const n = (i) => parseInt(h.slice(i, i + 2), 16);
    return { r: n(0), g: n(2), b: n(4), a: 1 };
  }
  return base;
}

/**
 * Monta um tema completo.
 *
 * @param {Object} spec
 * @param {number} spec.matiz 0-360
 * @param {'escuro'|'claro'|'classico'|'vibrante'} [spec.familia]
 * @param {'capsula'|'plano'|'contorno'|'bloco'} [spec.estilo]
 * @param {string} [spec.id]
 * @param {string} [spec.nome]
 * @param {string} [spec.grupo]
 * @returns {import('./temas.js').Tema}
 */
export function gerarTema({ matiz, familia = 'escuro', estilo = 'capsula', id, nome, grupo }) {
  const h = ((Math.round(matiz) % 360) + 360) % 360;
  const fam = FAMILIAS.includes(familia) ? familia : 'escuro';
  const est = ESTILOS.includes(estilo) ? estilo : 'capsula';
  const r = receitaFamilia(fam, h, est);
  const acc = r.acento;
  const escura = r.escura;

  // Fundos efetivos das duas faixas de linha, já compostos sobre a página.
  const fundoA = comoRgb(r.linhaA, r.base);
  const fundoB = comoRgb(r.linhaB, r.base);
  // A faixa mais difícil é a de luminância mais próxima da tinta que virá.
  const faixaDificil = escura
    ? (luminancia(fundoA) > luminancia(fundoB) ? fundoA : fundoB)
    : (luminancia(fundoA) < luminancia(fundoB) ? fundoA : fundoB);

  const rumo = escura ? 'claro' : 'escuro';
  const lTinta = escura ? 95 : 20;
  const lSuave = escura ? 72 : 42;

  const linhaTinta = tintaSobre(h, 16, lTinta, faixaDificil, FORTE, rumo);
  const linhaTintaSuave = tintaSobre(h, 20, lSuave, faixaDificil, SUAVE, rumo);
  const tinta = tintaSobre(h, 14, lTinta, r.base, FORTE, rumo);
  const tintaSuave = tintaSobre(h, 22, lSuave, r.base, SUAVE, rumo);
  const titulo = tintaSobre(h, escura ? 8 : 62, escura ? 99 : 30, r.base, SUAVE, rumo);

  /*
   * Faixa de seção, preço à vista e selo são cápsulas de acento com texto
   * claro por cima. Aqui a tinta não pode ceder — já é branca —, então quem
   * se ajusta é o fundo: em matiz amarela ou verde, branco sobre o acento na
   * luminosidade "bonita" não fecha 4.5, e escurecer o fundo é a única saída.
   */
  const BRANCO = { r: 255, g: 255, b: 255 };

  const secaoSat = escura ? 62 : 56;
  const secaoLClara = luminosidadeDeFundo(acc, secaoSat, escura ? 42 : 38, BRANCO, FORTE, 'escuro');
  const secaoFundo = `linear-gradient(90deg, ${hsl(acc, secaoSat - 4, secaoLClara - 8)}, ${hsl(acc, secaoSat, secaoLClara)})`;
  const secaoTinta = tintaSobre(acc, 16, 98, hslParaRgb(acc, secaoSat, secaoLClara), FORTE, 'claro');

  // Preço à vista: o elemento mais visível do catálogo, sempre em cápsula cheia.
  const avistaSat = escura ? 70 : 60;
  const avistaLClara = luminosidadeDeFundo(acc, avistaSat, escura ? 50 : 42, BRANCO, SUAVE, 'escuro');
  const precoAvistaFundo = `linear-gradient(180deg, ${hsl(acc, avistaSat, avistaLClara)}, ${hsl(acc, avistaSat + 4, avistaLClara - 12)})`;
  const precoAvistaTinta = tintaSobre(acc, 12, 98, hslParaRgb(acc, avistaSat, avistaLClara), SUAVE, 'claro');

  // Preço parcelado: discreto, sobre a própria linha.
  const parceladoFundo = escura ? 'rgba(255,255,255,.08)' : 'transparent';
  const parceladoBase = escura ? comoRgb(parceladoFundo, r.base) : r.base;
  const precoParceladoTinta = tintaSobre(h, 16, lTinta, parceladoBase, SUAVE, rumo);

  const pilulaFundoRgb = hslParaRgb(h, escura ? 42 : 40, escura ? 26 : 88);
  const pilulaFundo = hsl(h, escura ? 42 : 40, escura ? 26 : 88);
  const pilulaTinta = tintaSobre(h, 26, escura ? 92 : 22, pilulaFundoRgb, FORTE, rumo);

  const seloMatiz = (acc + 180) % 360;
  const seloL = luminosidadeDeFundo(seloMatiz, 62, escura ? 46 : 40, BRANCO, FORTE, 'escuro');
  const seloFundo = hsl(seloMatiz, 62, seloL);
  const seloTinta = tintaSobre(seloMatiz, 14, 98, hslParaRgb(seloMatiz, 62, seloL), FORTE, 'claro');

  const identificador = id ?? `${fam}-${h}-${est}`;
  const rotulo = nome ?? `${nomeDaMatiz(h)} ${NOME_FAMILIA[fam]}`;

  return {
    id: identificador,
    nome: rotulo,
    grupo: grupo ?? `Gerados · ${NOME_FAMILIA[fam][0].toUpperCase()}${NOME_FAMILIA[fam].slice(1)}s`,
    origem: 'gerado',
    matiz: h,
    familia: fam,
    estilo: est,
    vars: {
      '--fundo': r.fundo,
      '--fundo-brilho': r.brilho,
      '--foto-veu': r.veu,
      '--tinta': tinta,
      '--tinta-suave': tintaSuave,
      '--destaque': hsl(acc, escura ? 80 : 62, escura ? 62 : 42),
      '--titulo': titulo,
      '--titulo-realce': hsl(acc, escura ? 82 : 60, escura ? 66 : 40),
      '--secao-fundo': secaoFundo,
      '--secao-tinta': secaoTinta,
      '--linha-tinta': linhaTinta,
      '--linha-tinta-suave': linhaTintaSuave,
      '--linha-a': r.linhaA,
      '--linha-b': r.linhaB,
      '--linha-borda': r.borda,
      '--pilula-fundo': pilulaFundo,
      '--pilula-tinta': pilulaTinta,
      '--preco-parcelado-fundo': parceladoFundo,
      '--preco-parcelado-tinta': precoParceladoTinta,
      '--preco-avista-fundo': precoAvistaFundo,
      '--preco-avista-tinta': precoAvistaTinta,
      '--selo-fundo': seloFundo,
      '--selo-tinta': seloTinta,
      '--rodape-tinta': escura ? 'rgba(255,255,255,.5)' : tintaSuave,
      '--raio-mult': String(RECEITA_ESTILO[est].raio),
    },
  };
}

/**
 * Catálogo fixo de temas gerados.
 *
 * 26 matizes espaçadas de ~13.8° cobrem o círculo sem repetir cor perceptível;
 * cruzadas com as quatro famílias dão 104 temas. O estilo alterna para que
 * vizinhos na lista não pareçam o mesmo tema em outra cor.
 */
export function catalogoGerado({ matizes = 26 } = {}) {
  const temas = [];
  for (let i = 0; i < matizes; i += 1) {
    const h = Math.round((i * 360) / matizes);
    FAMILIAS.forEach((familia, j) => {
      const estilo = ESTILOS[(i + j) % ESTILOS.length];
      temas.push(gerarTema({ matiz: h, familia, estilo }));
    });
  }
  return temas;
}

/*
 * Ângulo áureo: passos sucessivos nunca caem perto de uma matiz já usada, o que
 * dá a sensação de "sempre diferente" que uma matiz puramente aleatória não
 * garante — sorteio uniforme repete vizinhança com frequência incômoda.
 */
const ANGULO_AUREO = 137.508;

/** Distância entre duas matizes no círculo, de 0 a 180 graus. */
export function distanciaDeMatiz(a, b) {
  return Math.abs((((a - b) % 360) + 540) % 360 - 180);
}

/**
 * Sorteia um tema inédito.
 *
 * `contador` faz a matiz avançar pelo ângulo áureo; guarde-o entre execuções
 * para que cada catálogo do dia saia com cor claramente distinta do anterior.
 *
 * @param {Object} [opcoes]
 * @param {number} [opcoes.contador] Quantos sorteios já houve
 * @param {number[]} [opcoes.evitar] Matizes recentes a manter distância
 * @param {string[]} [opcoes.familias] Restringe as famílias sorteadas
 * @returns {import('./temas.js').Tema}
 */
export function sortearTema({ contador = 0, evitar = [], familias = FAMILIAS } = {}) {
  const disponiveis = familias.filter((f) => FAMILIAS.includes(f));
  const lista = disponiveis.length ? disponiveis : FAMILIAS;

  /*
   * O ângulo áureo já garante o que mais importa: sorteios consecutivos ficam
   * a 137° um do outro. `evitar` é ajuste fino sobre isso, não substituto —
   * exigir 40° de folga de seis matizes seria pedir 480° num círculo de 360, e
   * a busca degenerava justamente aproximando cores vizinhas.
   */
  const ultima = evitar.length ? evitar[evitar.length - 1] : null;
  let matiz = (contador * ANGULO_AUREO) % 360;

  for (let i = 0; i < 6; i += 1) {
    if (!evitar.some((m) => distanciaDeMatiz(matiz, m) < 25)) break;
    const tentativa = (matiz + ANGULO_AUREO) % 360;
    // Desviar para perto da cor imediatamente anterior é pior que a colisão
    // antiga que estávamos tentando evitar.
    if (ultima !== null && distanciaDeMatiz(tentativa, ultima) < 40) break;
    matiz = tentativa;
  }

  const familia = lista[contador % lista.length];
  const estilo = ESTILOS[Math.floor(contador / lista.length) % ESTILOS.length];

  const tema = gerarTema({
    matiz,
    familia,
    estilo,
    id: `sorteado-${Math.round(matiz)}-${familia}-${estilo}`,
    grupo: 'Sorteado',
  });
  tema.origem = 'sorteado';
  return tema;
}

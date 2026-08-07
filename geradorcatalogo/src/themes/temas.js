/**
 * Paletas.
 *
 * Um tema é só um conjunto de variáveis CSS. Para criar outro, copie um objeto,
 * troque as cores e adicione ao mapa `TEMAS` — nada mais no projeto precisa
 * mudar. `fundo` aceita qualquer valor válido de `background` (cor sólida,
 * gradiente ou `url(...)` com imagem embutida em base64).
 */

/**
 * @typedef {Object} Tema
 * @property {string} id
 * @property {string} nome
 * @property {Record<string,string>} vars Variáveis CSS aplicadas na página
 */

/** @type {Record<string, Tema>} */
export const TEMAS = {
  noite: {
    id: 'noite',
    nome: 'Noite (azul)',
    vars: {
      '--fundo': 'linear-gradient(160deg, #0b1b3a 0%, #12294f 45%, #0a1730 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 78% 12%, rgba(56,189,248,.20), transparent 55%)',
      '--tinta': '#f1f6ff',
      '--tinta-suave': '#9db4d8',
      '--destaque': '#38bdf8',
      '--titulo': '#ffffff',
      '--titulo-realce': '#38bdf8',
      '--secao-fundo': 'linear-gradient(90deg, #1e3a8a, #2563eb)',
      '--secao-tinta': '#ffffff',
      '--linha-tinta': '#f1f6ff',
      '--linha-tinta-suave': '#9db4d8',
      '--linha-a': 'rgba(255,255,255,.07)',
      '--linha-b': 'rgba(255,255,255,.03)',
      '--linha-borda': 'rgba(148,197,255,.16)',
      '--pilula-fundo': '#123a6b',
      '--pilula-tinta': '#dbeafe',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.08)',
      '--preco-parcelado-tinta': '#dbeafe',
      '--preco-avista-fundo': 'linear-gradient(180deg, #0ea5e9, #0369a1)',
      '--preco-avista-tinta': '#ffffff',
      '--selo-fundo': '#f59e0b',
      '--selo-tinta': '#1f1300',
      '--rodape-tinta': 'rgba(255,255,255,.55)',
    },
  },

  natal: {
    id: 'natal',
    nome: 'Natal (verde e vinho)',
    vars: {
      '--fundo': 'linear-gradient(170deg, #f6f1e7 0%, #eee5d4 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 20% 8%, rgba(200,30,45,.10), transparent 45%)',
      '--tinta': '#25321f',
      '--tinta-suave': '#6b7355',
      '--destaque': '#9f1239',
      '--titulo': '#7f1d1d',
      '--titulo-realce': '#14532d',
      '--secao-fundo': 'linear-gradient(90deg, #14532d, #166534)',
      '--secao-tinta': '#fef9c3',
      '--linha-tinta': '#f7f3e6',
      '--linha-tinta-suave': 'rgba(247,243,230,.72)',
      '--linha-a': '#2f3f27',
      '--linha-b': '#5b1620',
      '--linha-borda': 'rgba(0,0,0,.10)',
      '--pilula-fundo': '#f3ead8',
      '--pilula-tinta': '#3b2f1c',
      '--preco-parcelado-fundo': '#2f3f27',
      '--preco-parcelado-tinta': '#f7f3e6',
      '--preco-avista-fundo': '#5b1620',
      '--preco-avista-tinta': '#ffe9b0',
      '--selo-fundo': '#b45309',
      '--selo-tinta': '#fff7ed',
      '--rodape-tinta': 'rgba(60,50,35,.60)',
    },
  },

  rose: {
    id: 'rose',
    nome: 'Rosé (claro)',
    vars: {
      '--fundo': 'linear-gradient(165deg, #fdf3f0 0%, #f7e6e2 55%, #f1dcdd 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 85% 10%, rgba(224,122,130,.16), transparent 50%)',
      '--tinta': '#3c2b2b',
      '--tinta-suave': '#8b6f6f',
      '--destaque': '#b04a55',
      '--titulo': '#a03b48',
      '--titulo-realce': '#7d2b38',
      '--secao-fundo': 'linear-gradient(90deg, #e8c9c4, #dbb0ad)',
      '--secao-tinta': '#5a2a30',
      '--linha-tinta': '#3c2b2b',
      '--linha-tinta-suave': '#8b6f6f',
      '--linha-a': '#eddad3',
      '--linha-b': '#fbeeea',
      '--linha-borda': 'rgba(120,70,70,.10)',
      '--pilula-fundo': '#f6e3de',
      '--pilula-tinta': '#6b4247',
      '--preco-parcelado-fundo': 'transparent',
      '--preco-parcelado-tinta': '#2b2020',
      '--preco-avista-fundo': 'transparent',
      '--preco-avista-tinta': '#a83a48',
      '--selo-fundo': '#c2607a',
      '--selo-tinta': '#fff5f6',
      '--rodape-tinta': 'rgba(90,60,60,.55)',
    },
  },

  neon: {
    id: 'neon',
    nome: 'Neon (escuro)',
    vars: {
      '--fundo': 'linear-gradient(155deg, #0a0a0f 0%, #14101f 50%, #090911 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 25% 85%, rgba(168,85,247,.22), transparent 55%)',
      '--tinta': '#eaeaf2',
      '--tinta-suave': '#9a9ab0',
      '--destaque': '#a855f7',
      '--titulo': '#ffffff',
      '--titulo-realce': '#22d3ee',
      '--secao-fundo': 'linear-gradient(90deg, #7c3aed, #db2777)',
      '--secao-tinta': '#ffffff',
      '--linha-tinta': '#eaeaf2',
      '--linha-tinta-suave': '#9a9ab0',
      '--linha-a': 'rgba(255,255,255,.06)',
      '--linha-b': 'rgba(255,255,255,.02)',
      '--linha-borda': 'rgba(168,85,247,.20)',
      '--pilula-fundo': '#241a3a',
      '--pilula-tinta': '#ddd6fe',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.07)',
      '--preco-parcelado-tinta': '#e9d5ff',
      '--preco-avista-fundo': 'linear-gradient(180deg, #22d3ee, #0891b2)',
      '--preco-avista-tinta': '#04212b',
      '--selo-fundo': '#f43f5e',
      '--selo-tinta': '#ffffff',
      '--rodape-tinta': 'rgba(255,255,255,.45)',
    },
  },

  limpo: {
    id: 'limpo',
    nome: 'Limpo (branco)',
    vars: {
      '--fundo': '#ffffff',
      '--fundo-brilho': 'radial-gradient(circle at 90% 5%, rgba(37,99,235,.08), transparent 45%)',
      '--tinta': '#111827',
      '--tinta-suave': '#6b7280',
      '--destaque': '#2563eb',
      '--titulo': '#111827',
      '--titulo-realce': '#2563eb',
      '--secao-fundo': '#111827',
      '--secao-tinta': '#ffffff',
      '--linha-tinta': '#111827',
      '--linha-tinta-suave': '#6b7280',
      '--linha-a': '#f3f4f6',
      '--linha-b': '#ffffff',
      '--linha-borda': '#e5e7eb',
      '--pilula-fundo': '#f3f4f6',
      '--pilula-tinta': '#374151',
      '--preco-parcelado-fundo': 'transparent',
      '--preco-parcelado-tinta': '#111827',
      '--preco-avista-fundo': 'transparent',
      '--preco-avista-tinta': '#1d4ed8',
      '--selo-fundo': '#f59e0b',
      '--selo-tinta': '#1f2937',
      '--rodape-tinta': '#9ca3af',
    },
  },
};

export const TEMA_PADRAO = 'noite';

export function obterTema(id) {
  return TEMAS[id] ?? TEMAS[TEMA_PADRAO];
}

export function listarTemas() {
  return Object.values(TEMAS).map(({ id, nome }) => ({ id, nome }));
}

/**
 * Monta o bloco `style` da página a partir do tema, aplicando substituições
 * pontuais (fundo customizado, cor de destaque escolhida na hora).
 */
export function varsCss(temaId, sobrescritas = {}) {
  const tema = obterTema(temaId);
  const vars = { ...tema.vars, ...sobrescritas };
  return Object.entries(vars)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

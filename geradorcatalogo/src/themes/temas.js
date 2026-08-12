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
 * @property {string} grupo Família à qual pertence, para agrupar no seletor
 * @property {Record<string,string>} vars Variáveis CSS aplicadas na página
 */

import { catalogoGerado, sortearTema } from './gerador.js';

export { gerarTema, sortearTema, FAMILIAS, ESTILOS } from './gerador.js';

/** @type {Record<string, Tema>} */
export const TEMAS_CURADOS = {
  noite: {
    id: 'noite',
    nome: 'Noite (azul)',
    grupo: 'Escuros',
    vars: {
      '--fundo': 'linear-gradient(160deg, #0b1b3a 0%, #12294f 45%, #0a1730 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 78% 12%, rgba(56,189,248,.20), transparent 55%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(8,20,42,.86) 0%, rgba(8,20,42,.74) 45%, rgba(8,20,42,.90) 100%)',
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
      '--preco-avista-fundo': 'linear-gradient(180deg, #0369a1, #075985)',
      '--preco-avista-tinta': '#ffffff',
      '--selo-fundo': '#f59e0b',
      '--selo-tinta': '#1f1300',
      '--rodape-tinta': 'rgba(255,255,255,.55)',
    },
  },

  natal: {
    id: 'natal',
    nome: 'Natal (verde e vinho)',
    grupo: 'Sazonais',
    vars: {
      '--fundo': 'linear-gradient(170deg, #f6f1e7 0%, #eee5d4 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 20% 8%, rgba(200,30,45,.10), transparent 45%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(246,241,231,.90) 0%, rgba(238,229,212,.82) 50%, rgba(246,241,231,.92) 100%)',
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
    grupo: 'Claros',
    vars: {
      '--fundo': 'linear-gradient(165deg, #fdf3f0 0%, #f7e6e2 55%, #f1dcdd 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 85% 10%, rgba(224,122,130,.16), transparent 50%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(253,243,240,.90) 0%, rgba(247,230,226,.82) 50%, rgba(241,220,221,.92) 100%)',
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
      '--selo-fundo': '#9d3b52',
      '--selo-tinta': '#fff5f6',
      '--rodape-tinta': 'rgba(90,60,60,.55)',
    },
  },

  neon: {
    id: 'neon',
    nome: 'Neon (escuro)',
    grupo: 'Escuros',
    vars: {
      '--fundo': 'linear-gradient(155deg, #0a0a0f 0%, #14101f 50%, #090911 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 25% 85%, rgba(168,85,247,.22), transparent 55%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(10,10,15,.88) 0%, rgba(20,16,31,.78) 50%, rgba(9,9,17,.92) 100%)',
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
      '--selo-fundo': '#be123c',
      '--selo-tinta': '#ffffff',
      '--rodape-tinta': 'rgba(255,255,255,.45)',
    },
  },

  limpo: {
    id: 'limpo',
    nome: 'Limpo (branco)',
    grupo: 'Claros',
    vars: {
      '--fundo': '#ffffff',
      '--fundo-brilho': 'radial-gradient(circle at 90% 5%, rgba(37,99,235,.08), transparent 45%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.86) 50%, rgba(255,255,255,.94) 100%)',
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
  grafite: {
    id: 'grafite',
    nome: 'Grafite (moderno)',
    grupo: 'Escuros',
    vars: {
      '--fundo': 'linear-gradient(165deg, #17181c 0%, #212429 50%, #131418 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 82% 8%, rgba(249,115,22,.16), transparent 55%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(6,10,20,.88) 0%, rgba(6,10,20,.76) 50%, rgba(6,10,20,.92) 100%)',
      '--tinta': '#f4f6fa',
      '--tinta-suave': '#9aa6bb',
      '--destaque': '#fb923c',
      '--titulo': '#ffffff',
      '--titulo-realce': '#fb923c',
      '--secao-fundo': 'linear-gradient(90deg, #ea580c, #f97316)',
      '--secao-tinta': '#1a1206',
      '--linha-tinta': '#f4f6fa',
      '--linha-tinta-suave': '#9aa6bb',
      '--linha-a': 'rgba(255,255,255,.065)',
      '--linha-b': 'rgba(255,255,255,.025)',
      '--linha-borda': 'rgba(255,255,255,.12)',
      '--pilula-fundo': '#2b2f37',
      '--pilula-tinta': '#e3e7ee',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.08)',
      '--preco-parcelado-tinta': '#e6ecf6',
      '--preco-avista-fundo': 'linear-gradient(180deg, #c2410c, #9a3412)',
      '--preco-avista-tinta': '#ffffff',
      '--selo-fundo': '#f97316',
      '--selo-tinta': '#1a1206',
      '--rodape-tinta': 'rgba(255,255,255,.5)',
    },
  },

  oceano: {
    id: 'oceano',
    nome: 'Oceano (moderno)',
    grupo: 'Escuros',
    vars: {
      '--fundo': 'linear-gradient(160deg, #042f2e 0%, #0b514c 48%, #032a29 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 20% 88%, rgba(45,212,191,.18), transparent 55%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(6,10,20,.88) 0%, rgba(6,10,20,.76) 50%, rgba(6,10,20,.92) 100%)',
      '--tinta': '#f4f6fa',
      '--tinta-suave': '#93b8b2',
      '--destaque': '#5eead4',
      '--titulo': '#ffffff',
      '--titulo-realce': '#5eead4',
      '--secao-fundo': 'linear-gradient(90deg, #115e59, #0f766e)',
      '--secao-tinta': '#ffffff',
      '--linha-tinta': '#f4f6fa',
      '--linha-tinta-suave': '#93b8b2',
      '--linha-a': 'rgba(255,255,255,.065)',
      '--linha-b': 'rgba(255,255,255,.025)',
      '--linha-borda': 'rgba(94,234,212,.20)',
      '--pilula-fundo': '#0c4741',
      '--pilula-tinta': '#ccfbf1',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.08)',
      '--preco-parcelado-tinta': '#e6ecf6',
      '--preco-avista-fundo': 'linear-gradient(180deg, #2dd4bf, #0d9488)',
      '--preco-avista-tinta': '#03241f',
      '--selo-fundo': '#fbbf24',
      '--selo-tinta': '#1c1400',
      '--rodape-tinta': 'rgba(255,255,255,.5)',
    },
  },

  ultravioleta: {
    id: 'ultravioleta',
    nome: 'Ultravioleta (moderno)',
    grupo: 'Escuros',
    vars: {
      '--fundo': 'linear-gradient(160deg, #1e1b4b 0%, #322e86 50%, #17143a 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 78% 82%, rgba(129,140,248,.22), transparent 55%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(6,10,20,.88) 0%, rgba(6,10,20,.76) 50%, rgba(6,10,20,.92) 100%)',
      '--tinta': '#f4f6fa',
      '--tinta-suave': '#a9adde',
      '--destaque': '#a5b4fc',
      '--titulo': '#ffffff',
      '--titulo-realce': '#a5b4fc',
      '--secao-fundo': 'linear-gradient(90deg, #4f46e5, #7c3aed)',
      '--secao-tinta': '#ffffff',
      '--linha-tinta': '#f4f6fa',
      '--linha-tinta-suave': '#a9adde',
      '--linha-a': 'rgba(255,255,255,.065)',
      '--linha-b': 'rgba(255,255,255,.025)',
      '--linha-borda': 'rgba(165,180,252,.22)',
      '--pilula-fundo': '#2c2a6b',
      '--pilula-tinta': '#dfe2fe',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.08)',
      '--preco-parcelado-tinta': '#e6ecf6',
      '--preco-avista-fundo': 'linear-gradient(180deg, #c7d2fe, #a5b4fc)',
      '--preco-avista-tinta': '#1e1b4b',
      '--selo-fundo': '#fbbf24',
      '--selo-tinta': '#1c1400',
      '--rodape-tinta': 'rgba(255,255,255,.5)',
    },
  },

  menta: {
    id: 'menta',
    nome: 'Menta (claro)',
    grupo: 'Claros',
    vars: {
      '--fundo': 'linear-gradient(165deg, #f0fdf9 0%, #ddf7ea 55%, #ecfdf5 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 86% 10%, rgba(16,185,129,.14), transparent 50%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.84) 50%, rgba(255,255,255,.94) 100%)',
      '--tinta': '#10251f',
      '--tinta-suave': '#517a6d',
      '--destaque': '#047857',
      '--titulo': '#065f46',
      '--titulo-realce': '#047857',
      '--secao-fundo': 'linear-gradient(90deg, #064e3b, #047857)',
      '--secao-tinta': '#ecfdf5',
      '--linha-tinta': '#10251f',
      '--linha-tinta-suave': '#517a6d',
      '--linha-a': '#ffffff',
      '--linha-b': '#e6f8f0',
      '--linha-borda': 'rgba(6,95,70,.13)',
      '--pilula-fundo': '#d1fae5',
      '--pilula-tinta': '#064e3b',
      '--preco-parcelado-fundo': 'transparent',
      '--preco-parcelado-tinta': '#10251f',
      '--preco-avista-fundo': 'transparent',
      '--preco-avista-tinta': '#047857',
      '--selo-fundo': '#047857',
      '--selo-tinta': '#ffffff',
      '--rodape-tinta': '#517a6d',
    },
  },

  coral: {
    id: 'coral',
    nome: 'Coral (claro)',
    grupo: 'Claros',
    vars: {
      '--fundo': 'linear-gradient(165deg, #fff7ed 0%, #ffe9d5 55%, #fff2e7 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 84% 12%, rgba(234,88,12,.14), transparent 50%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.84) 50%, rgba(255,255,255,.94) 100%)',
      '--tinta': '#3b1508',
      '--tinta-suave': '#8d6350',
      '--destaque': '#9a3412',
      '--titulo': '#c2410c',
      '--titulo-realce': '#9a3412',
      '--secao-fundo': 'linear-gradient(90deg, #9a3412, #c2410c)',
      '--secao-tinta': '#fff7ed',
      '--linha-tinta': '#3b1508',
      '--linha-tinta-suave': '#8d6350',
      '--linha-a': '#ffffff',
      '--linha-b': '#fdeee1',
      '--linha-borda': 'rgba(120,60,20,.12)',
      '--pilula-fundo': '#ffe4cc',
      '--pilula-tinta': '#7c2d12',
      '--preco-parcelado-fundo': 'transparent',
      '--preco-parcelado-tinta': '#3b1508',
      '--preco-avista-fundo': 'transparent',
      '--preco-avista-tinta': '#b8390b',
      '--selo-fundo': '#9a3412',
      '--selo-tinta': '#fff7ed',
      '--rodape-tinta': '#8d6350',
    },
  },

  verao: {
    id: 'verao',
    nome: 'Verão (claro)',
    grupo: 'Claros',
    vars: {
      '--fundo': 'linear-gradient(165deg, #fffbeb 0%, #e8feff 55%, #fef7c8 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 12% 88%, rgba(6,182,212,.16), transparent 52%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.84) 50%, rgba(255,255,255,.94) 100%)',
      '--tinta': '#0f3238',
      '--tinta-suave': '#4d757b',
      '--destaque': '#0369a1',
      '--titulo': '#0e7490',
      '--titulo-realce': '#0369a1',
      '--secao-fundo': 'linear-gradient(90deg, #155e75, #0e7490)',
      '--secao-tinta': '#ffffff',
      '--linha-tinta': '#0f3238',
      '--linha-tinta-suave': '#4d757b',
      '--linha-a': '#ffffff',
      '--linha-b': '#e9fbfd',
      '--linha-borda': 'rgba(8,145,178,.15)',
      '--pilula-fundo': '#cffafe',
      '--pilula-tinta': '#0c4d5c',
      '--preco-parcelado-fundo': 'transparent',
      '--preco-parcelado-tinta': '#0f3238',
      '--preco-avista-fundo': 'transparent',
      '--preco-avista-tinta': '#0369a1',
      '--selo-fundo': '#d97706',
      '--selo-tinta': '#2b1a03',
      '--rodape-tinta': '#4d757b',
    },
  },

  marinho: {
    id: 'marinho',
    nome: 'Marinho e ouro (clássico)',
    grupo: 'Clássicos',
    vars: {
      '--fundo': 'linear-gradient(170deg, #0a1f3c 0%, #103057 50%, #07182e 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 80% 10%, rgba(212,175,55,.14), transparent 52%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(6,10,20,.88) 0%, rgba(6,10,20,.76) 50%, rgba(6,10,20,.92) 100%)',
      '--tinta': '#f4f6fa',
      '--tinta-suave': '#a7b8ce',
      '--destaque': '#d4af37',
      '--titulo': '#ffffff',
      '--titulo-realce': '#d4af37',
      '--secao-fundo': 'linear-gradient(90deg, #d4af37, #b8952e)',
      '--secao-tinta': '#10233d',
      '--linha-tinta': '#f4f6fa',
      '--linha-tinta-suave': '#a7b8ce',
      '--linha-a': 'rgba(255,255,255,.065)',
      '--linha-b': 'rgba(255,255,255,.025)',
      '--linha-borda': 'rgba(212,175,55,.24)',
      '--pilula-fundo': '#123a61',
      '--pilula-tinta': '#e9eff8',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.08)',
      '--preco-parcelado-tinta': '#e6ecf6',
      '--preco-avista-fundo': 'linear-gradient(180deg, #d4af37, #a8842a)',
      '--preco-avista-tinta': '#0f1d31',
      '--selo-fundo': '#d4af37',
      '--selo-tinta': '#10233d',
      '--rodape-tinta': 'rgba(255,255,255,.5)',
    },
  },

  esmeralda: {
    id: 'esmeralda',
    nome: 'Esmeralda (clássico)',
    grupo: 'Clássicos',
    vars: {
      '--fundo': 'linear-gradient(170deg, #052e1c 0%, #0a4d31 50%, #032417 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 18% 12%, rgba(233,216,166,.14), transparent 52%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(6,10,20,.88) 0%, rgba(6,10,20,.76) 50%, rgba(6,10,20,.92) 100%)',
      '--tinta': '#f4f6fa',
      '--tinta-suave': '#a1c0ac',
      '--destaque': '#e9d8a6',
      '--titulo': '#ffffff',
      '--titulo-realce': '#e9d8a6',
      '--secao-fundo': 'linear-gradient(90deg, #e9d8a6, #d2ba82)',
      '--secao-tinta': '#08321f',
      '--linha-tinta': '#f4f6fa',
      '--linha-tinta-suave': '#a1c0ac',
      '--linha-a': 'rgba(255,255,255,.065)',
      '--linha-b': 'rgba(255,255,255,.025)',
      '--linha-borda': 'rgba(233,216,166,.22)',
      '--pilula-fundo': '#0d4630',
      '--pilula-tinta': '#eef4ea',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.08)',
      '--preco-parcelado-tinta': '#e6ecf6',
      '--preco-avista-fundo': 'linear-gradient(180deg, #e9d8a6, #c9ac6b)',
      '--preco-avista-tinta': '#082c1b',
      '--selo-fundo': '#c9ac6b',
      '--selo-tinta': '#082c1b',
      '--rodape-tinta': 'rgba(255,255,255,.5)',
    },
  },

  vinho: {
    id: 'vinho',
    nome: 'Vinho (clássico)',
    grupo: 'Clássicos',
    vars: {
      '--fundo': 'linear-gradient(170deg, #3b0d1a 0%, #611328 50%, #2c0a14 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 82% 84%, rgba(240,201,135,.14), transparent 52%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(6,10,20,.88) 0%, rgba(6,10,20,.76) 50%, rgba(6,10,20,.92) 100%)',
      '--tinta': '#f4f6fa',
      '--tinta-suave': '#d3a6ab',
      '--destaque': '#f0c987',
      '--titulo': '#ffffff',
      '--titulo-realce': '#f0c987',
      '--secao-fundo': 'linear-gradient(90deg, #f0c987, #d9ac63)',
      '--secao-tinta': '#3b0d1a',
      '--linha-tinta': '#f4f6fa',
      '--linha-tinta-suave': '#d3a6ab',
      '--linha-a': 'rgba(255,255,255,.065)',
      '--linha-b': 'rgba(255,255,255,.025)',
      '--linha-borda': 'rgba(240,201,135,.22)',
      '--pilula-fundo': '#5a1929',
      '--pilula-tinta': '#fbeee4',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.08)',
      '--preco-parcelado-tinta': '#e6ecf6',
      '--preco-avista-fundo': 'linear-gradient(180deg, #f0c987, #c99a52)',
      '--preco-avista-tinta': '#38101c',
      '--selo-fundo': '#f0c987',
      '--selo-tinta': '#38101c',
      '--rodape-tinta': 'rgba(255,255,255,.5)',
    },
  },

  sepia: {
    id: 'sepia',
    nome: 'Sépia (clássico)',
    grupo: 'Clássicos',
    vars: {
      '--fundo': 'linear-gradient(170deg, #f7f1e5 0%, #efe5d3 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 88% 8%, rgba(138,109,59,.10), transparent 48%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(255,255,255,.92) 0%, rgba(255,255,255,.84) 50%, rgba(255,255,255,.94) 100%)',
      '--tinta': '#3b2f21',
      '--tinta-suave': '#7a6850',
      '--destaque': '#8a4b20',
      '--titulo': '#4a3823',
      '--titulo-realce': '#8a4b20',
      '--secao-fundo': '#4a3823',
      '--secao-tinta': '#f7f1e5',
      '--linha-tinta': '#3b2f21',
      '--linha-tinta-suave': '#7a6850',
      '--linha-a': '#ffffff',
      '--linha-b': '#f3ecdd',
      '--linha-borda': 'rgba(74,56,35,.16)',
      '--pilula-fundo': '#eaddc4',
      '--pilula-tinta': '#4a3823',
      '--preco-parcelado-fundo': 'transparent',
      '--preco-parcelado-tinta': '#3b2f21',
      '--preco-avista-fundo': 'transparent',
      '--preco-avista-tinta': '#8a4b20',
      '--selo-fundo': '#7a5f33',
      '--selo-tinta': '#fbf6ea',
      '--rodape-tinta': '#7a6850',
    },
  },

  luxo: {
    id: 'luxo',
    nome: 'Preto e ouro (luxo)',
    grupo: 'Clássicos',
    vars: {
      '--fundo': 'linear-gradient(165deg, #0a0a0a 0%, #17171a 50%, #040404 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 76% 14%, rgba(212,175,55,.14), transparent 52%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(6,10,20,.88) 0%, rgba(6,10,20,.76) 50%, rgba(6,10,20,.92) 100%)',
      '--tinta': '#f5f5f5',
      '--tinta-suave': '#a8a8a8',
      '--destaque': '#d4af37',
      '--titulo': '#ffffff',
      '--titulo-realce': '#d4af37',
      '--secao-fundo': 'linear-gradient(90deg, #d4af37, #9c7c22)',
      '--secao-tinta': '#0a0a0a',
      '--linha-tinta': '#f5f5f5',
      '--linha-tinta-suave': '#a8a8a8',
      '--linha-a': 'rgba(255,255,255,.065)',
      '--linha-b': 'rgba(255,255,255,.025)',
      '--linha-borda': 'rgba(212,175,55,.22)',
      '--pilula-fundo': '#241f12',
      '--pilula-tinta': '#ecdfb4',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.08)',
      '--preco-parcelado-tinta': '#e6ecf6',
      '--preco-avista-fundo': 'linear-gradient(180deg, #d4af37, #a8842a)',
      '--preco-avista-tinta': '#0a0a0a',
      '--selo-fundo': '#d4af37',
      '--selo-tinta': '#0a0a0a',
      '--rodape-tinta': 'rgba(255,255,255,.5)',
    },
  },

  blackfriday: {
    id: 'blackfriday',
    nome: 'Black Friday',
    grupo: 'Sazonais',
    vars: {
      '--fundo': 'linear-gradient(160deg, #000000 0%, #131313 50%, #000000 100%)',
      '--fundo-brilho': 'radial-gradient(circle at 22% 86%, rgba(250,204,21,.18), transparent 55%)',
      '--foto-veu': 'linear-gradient(180deg, rgba(6,10,20,.88) 0%, rgba(6,10,20,.76) 50%, rgba(6,10,20,.92) 100%)',
      '--tinta': '#ffffff',
      '--tinta-suave': '#a5a5ad',
      '--destaque': '#facc15',
      '--titulo': '#ffffff',
      '--titulo-realce': '#facc15',
      '--secao-fundo': 'linear-gradient(90deg, #facc15, #eab308)',
      '--secao-tinta': '#141100',
      '--linha-tinta': '#ffffff',
      '--linha-tinta-suave': '#a5a5ad',
      '--linha-a': 'rgba(255,255,255,.065)',
      '--linha-b': 'rgba(255,255,255,.025)',
      '--linha-borda': 'rgba(250,204,21,.24)',
      '--pilula-fundo': '#2a2409',
      '--pilula-tinta': '#fde68a',
      '--preco-parcelado-fundo': 'rgba(255,255,255,.08)',
      '--preco-parcelado-tinta': '#e6ecf6',
      '--preco-avista-fundo': 'linear-gradient(180deg, #facc15, #ca8a04)',
      '--preco-avista-tinta': '#1a1400',
      '--selo-fundo': '#b91c1c',
      '--selo-tinta': '#ffffff',
      '--rodape-tinta': 'rgba(255,255,255,.5)',
    },
  },
};

/*
 * Os curados vêm primeiro por serem os desenhados à mão; os gerados entram
 * depois, sem sobrescrever nenhum id existente.
 */
/** @type {Record<string, Tema>} */
export const TEMAS = { ...TEMAS_CURADOS };
for (const tema of catalogoGerado()) {
  if (!TEMAS[tema.id]) TEMAS[tema.id] = tema;
}

export const TEMA_PADRAO = 'noite';

/**
 * Resolve um tema a partir do id **ou** de um objeto de tema já pronto.
 *
 * Aceitar o objeto não é conveniência: a paginação roda dentro do navegador,
 * que tem a sua própria instância deste módulo. Um tema sorteado no Node e
 * registrado só lá não existiria do outro lado, e cairia calado no padrão.
 * Passar o objeto atravessa a fronteira.
 */
export function obterTema(temaOuId) {
  if (temaOuId && typeof temaOuId === 'object' && temaOuId.vars) return temaOuId;
  return TEMAS[temaOuId] ?? TEMAS[TEMA_PADRAO];
}

export function listarTemas() {
  return Object.values(TEMAS).map(({ id, nome, grupo }) => ({ id, nome, grupo }));
}

/** Ordem em que os grupos aparecem no seletor. Os curados vêm primeiro. */
export const GRUPOS = [
  'Escuros', 'Claros', 'Clássicos', 'Sazonais',
  'Gerados · Escuros', 'Gerados · Claros', 'Gerados · Clássicos', 'Gerados · Vibrantes',
];

/** Temas agrupados, para montar um seletor com 17 opções que não confunda. */
export function temasPorGrupo() {
  const todos = listarTemas();
  const conhecidos = GRUPOS.map((grupo) => ({
    grupo,
    temas: todos.filter((t) => t.grupo === grupo),
  }));
  // Grupo que apareça fora da ordem conhecida não pode sumir do seletor.
  const sobrando = todos.filter((t) => !GRUPOS.includes(t.grupo));
  for (const t of sobrando) {
    const alvo = conhecidos.find((g) => g.grupo === t.grupo);
    if (alvo) alvo.temas.push(t);
    else conhecidos.push({ grupo: t.grupo, temas: [t] });
  }
  return conhecidos.filter((g) => g.temas.length);
}

/**
 * Monta o bloco `style` da página a partir do tema, aplicando substituições
 * pontuais (fundo customizado, cor de destaque escolhida na hora).
 */
export function varsCss(temaOuId, sobrescritas = {}) {
  const tema = obterTema(temaOuId);
  const vars = { ...tema.vars, ...sobrescritas };
  return Object.entries(vars)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}:${v}`)
    .join(';');
}

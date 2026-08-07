# Gerador de Catálogos

Transforma as listas de produtos que você manda no WhatsApp em catálogos prontos
para stories — 9:16, 2160×3840 (4K vertical), em PNG.

Duas formas de usar:

| | Para quê | Fidelidade |
|---|---|---|
| **`index.html`** | Colar a lista, escolher tema, baixar. Não precisa instalar nada. | Boa |
| **`tools/render.mjs`** | Gerar em lote pelo terminal. | Exata |

O estúdio no navegador rasteriza via `<foreignObject>` de SVG, que é rápido mas
depende das fontes do sistema e não desenha emoji. O renderizador de linha de
comando fotografa um Chromium de verdade — é o caminho para publicar.

## Começando

```bash
npm install                 # só para o renderizador de linha de comando
npm test                    # parser + estúdio ponta a ponta

# um catálogo
node tools/render.mjs samples/smartphones.txt --tema noite --marca "@sualoja"

# escolhendo tema e destino
node tools/render.mjs samples/apple.txt --tema rose --saida ./saida
```

Para o estúdio, sirva a pasta (não abra por `file://` — os módulos ES precisam
de HTTP):

```bash
npx serve .        # ou: python3 -m http.server
```

### Opções do renderizador

| Opção | Padrão | O que faz |
|---|---|---|
| `--tema` | `noite` | `noite`, `natal`, `rose`, `neon`, `limpo` |
| `--saida` | `./saida` | Diretório de destino |
| `--marca` | — | Assinatura no rodapé |
| `--sobretitulo` | `Lista de produtos` | Linha acima do título |
| `--largura` | `2160` | Largura final; a altura sai de 16/9 |
| `--escala-max` | `1.15` | Teto do ajuste tipográfico |
| `--html` | — | Grava também o HTML de cada página |

## Como funciona

```
lista.txt ──▶ parser ──▶ Catalogo ──▶ paginação ──▶ páginas HTML ──▶ PNG 4K
              (texto)    (modelo)     (mede no DOM)   (tema)
```

O `Catalogo` no meio é o contrato do projeto. O parser só precisa saber
preenchê-lo; o render só precisa saber desenhá-lo. Formato novo de lista =
mexer no parser, nada mais.

```
src/
  model/schema.js       O modelo: Catalogo, Secao, Produto, Preco, Aviso
  parser/
    normalize.js        Limpa o markup do WhatsApp, guardando onde havia ênfase
    precos.js           Lê os formatos de preço e converte pt-BR para número
    cores.js            Reconhece cor e a separa da especificação técnica
    parse.js            Classifica cada linha e monta o Catalogo
  layout/paginate.js    Mede no DOM, quebra em páginas e ajusta a escala
  render/
    template.js         Modelo -> HTML
    catalogo.css        A folha de estilo; tudo derivado de --escala
    export.js           PNG no navegador
  themes/temas.js       As paletas
tools/
  render.mjs            Renderizador de linha de comando
  palco.html            Página que o Playwright usa para medir e fotografar
samples/                Listas reais, usadas como teste
tests/                  Testes do parser e do estúdio
```

### O parser

Não existe formato fixo, então nada é assumido por posição. Cada linha é
classificada por evidência: negrito, emoji, presença de `R$`, data entre
parênteses, citação com `>`.

O que ele já aguenta, tirado das listas reais:

- Cabeçalho variável — reconhecido pela data `(07/08/26)`, não pelo texto.
- Várias mensagens coladas viram catálogos separados (`parseVarios`).
- Seções por marca (`_*REALME*_`) ou por categoria (`PREMIUMS/SEMI-NOVOS`).
- Cor depois do negrito, dentro dele, ou solta numa linha órfã.
- Cor no meio da linha: `JBL Boombox 3 - Preta - 180w RMS` separa as duas coisas.
- Preço em seis formatos, inclusive `10 x R$ 99,99 (R$ 999,99)` e
  `10 de R$ 278,00(R$ 2.780)`.
- Erros de digitação reais: `R$ 1. 330`, `(Dinheiro88`, negrito fechado no
  lugar errado.
- `LANÇAMENTO` vira um selo, não fica no nome.
- Observações como `(Bateria 92%, Todo Original)` viram campo próprio.

O que ele não entende sai em `catalogo.avisos`, com nível e número da linha —
o estúdio mostra na lateral e o renderizador imprime no terminal. Nada é
descartado em silêncio.

### A paginação

O requisito de "não pode ter estrutura quebrada" não se resolve chutando quantos
produtos cabem por página: o nome de um produto ocupa uma, duas ou três linhas
conforme o texto. Então mede-se de verdade.

1. Renderiza tudo num medidor fora da tela e lê a altura real de cada linha.
2. Distribui nas páginas conforme o espaço que sobra.
3. Busca binária na escala tipográfica: para N páginas, acha a maior escala que
   ainda cabe em N. Começa com N=1 e sobe.
4. A sobra vertical vira espaçamento entre linhas, até um teto — lista curta não
   fica espremida no topo.

Detalhes que evitam o resultado feio:

- Título de seção sozinho no fim da página desce para a próxima.
- Página que começa no meio de uma seção ganha a faixa "(continuação)", e o
  espaço dela é reservado antes de decidir o corte.
- Coluna sem conteúdo não é desenhada: lista sem cor vira três colunas, não
  quatro com um buraco.

O mesmo código roda no navegador e no Playwright — os dois têm DOM.

### Os temas

Um tema é um conjunto de variáveis CSS em `src/themes/temas.js`. Para criar
outro, copie um objeto e troque as cores:

```js
meutema: {
  id: 'meutema',
  nome: 'Meu tema',
  vars: {
    '--fundo': 'linear-gradient(160deg, #123 0%, #456 100%)',
    '--linha-tinta': '#fff',      // tinta dentro da linha
    '--preco-avista-fundo': '#0ea5e9',
    // ...
  },
}
```

`--fundo` aceita cor sólida, gradiente ou `url(...)` com imagem em base64. O
estúdio ainda tem um campo para trocar só o fundo sem criar tema.

Duas tintas separadas de propósito: `--tinta` é a da página, `--linha-tinta` é a
de dentro da linha. Temas com linha escura sobre fundo claro (o `natal`) precisam
disso — sem separar, o texto some.

## Decisões ainda em aberto

Coisas que ficaram num padrão razoável, mas que valem sua opinião:

1. **Centavos.** Hoje o preço sai exato: `999,99`. Seus catálogos manuais
   arredondam para `999`. Arredondar por padrão?
2. **Foto do produto.** Seus catálogos manuais terminam com uma ou duas fotos
   grandes. Dá para fazer, mas alguém precisa fornecer as imagens — banco local
   por modelo? Busca automática?
3. **Fonte.** Está usando a fonte do sistema. Uma tipografia embutida deixaria o
   resultado idêntico em qualquer máquina, ao custo de ~100 KB no repositório.
4. **Produto com um preço só.** Fones e carregadores têm só o parcelado; a coluna
   "Dinheiro" fica com um traço. Alternativa: quando o produto tem preço único,
   ocupar as duas colunas.
5. **Ordenação.** Hoje mantém a ordem que você escreveu. Ordenar por preço dentro
   de cada seção é fácil, se quiser.
6. **Divisão em páginas.** Hoje corta pelo que couber. Poderia forçar uma seção
   por página (uma imagem para REALME, outra para XIAOMI).

## Testes

```bash
npm test
```

`tests/parse.test.mjs` roda o parser contra as quatro listas reais de `samples/`
— conta produtos, confere preços e cores caso a caso.

`tests/estudio.test.mjs` abre o `index.html` num Chromium, gera o catálogo,
verifica que **nenhuma linha vaza da página** e que o PNG sai em 2160×3840.
É o teste que pega regressão de CSS.

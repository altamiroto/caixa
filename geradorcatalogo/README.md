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
| `--tema` | `noite` | 121 temas, ou `aleatorio` para sortear |
| `--semente` | relógio | Torna o sorteio reproduzível |
| `--saida` | `./saida` | Diretório de destino |
| `--marca` | — | Assinatura no rodapé |
| `--sobretitulo` | `Lista de produtos` | Linha acima do título; vazio esconde |
| `--titulo` | o da lista | Substitui o título |
| `--data` | a da lista | Substitui a data |
| `--sem-data` / `--sem-subtitulo` | — | Escondem essas linhas |
| `--selo` | — | Destaca o lançamento como cápsula com esse texto |
| `--largura` | `2160` | Largura final; a altura sai de 16/9 |
| `--escala-max` | `1.15` | Teto do ajuste tipográfico |
| `--fundo-imagem` | — | Foto de fundo (jpg/png/webp), embutida em base64 |
| `--veu` | do tema | Cor/gradiente por cima da foto |
| `--paginas-max` | `1` | Teto de páginas por catálogo |
| `--remover` | — | Palavras a tirar do nome, separadas por vírgula |
| `--alinhar-nome` | `esquerda` | `esquerda`, `centro` ou `direita` |
| `--alinhar-cor` | `centro` | idem |
| `--alinhar-preco` | `centro` | idem |
| `--margens` | `padrao` | `padrao` ou `stories` (reserva a área da interface) |
| `--margem-topo` / `--margem-lateral` / `--margem-base` | do preset | Em px, base 1080×1920 |
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
    fonte.css           Inter embutida em base64 (+ INTER-LICENSE.txt)
    limpeza.js          Remove do nome as palavras que o usuário escolher
    export.js           PNG no navegador
  themes/
    temas.js            As 17 paletas curadas + o catálogo gerado
    gerador.js          Constrói paletas a partir de matiz, família e estilo
    cor.js              Conversão, composição e contraste
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
- `LANÇAMENTO` vira campo próprio (`marcador`), preservando a palavra escrita.
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

São **121**: 17 desenhadas à mão e 104 geradas.

| Família | Curados |
|---|---|
| Escuros | `noite`, `neon`, `grafite`, `oceano`, `ultravioleta` |
| Claros | `limpo`, `rose`, `menta`, `coral`, `verao` |
| Clássicos | `marinho`, `esmeralda`, `vinho`, `sepia`, `luxo` |
| Sazonais | `natal`, `blackfriday` |

Um tema é um conjunto de variáveis CSS. Para criar outro à mão, copie um objeto
em `src/themes/temas.js` e troque as cores; `--fundo` aceita cor sólida,
gradiente ou `url(...)` com imagem em base64.

Duas tintas separadas de propósito: `--tinta` é a da página, `--linha-tinta` é a
de dentro da linha. Temas com linha escura sobre fundo claro (o `natal`) precisam
disso — sem separar, o texto some.

#### O gerador

Escrever cem paletas à mão daria cem chances de errar contraste. As 104 geradas
são **construídas**: o fundo sai de uma receita por família, e cada tinta é
calculada por `tintaSobre`, que caminha a luminosidade até fechar a razão
exigida. Quando a tinta não pode ceder — a faixa de seção já é branca —, a busca
inverte e é o fundo que escurece (`luminosidadeDeFundo`). Em matiz amarela ou
verde, branco sobre o acento "bonito" não fecha 4.5, e essa é a única saída.

Três eixos de variação:

- **matiz** (0–360), 26 posições no círculo;
- **família**: `escuro`, `claro`, `classico`, `vibrante`;
- **estilo**: `capsula`, `plano`, `contorno`, `bloco` — muda o raio das
  cápsulas, o preenchimento e a borda da linha, via `--raio-mult`.

#### Tema aleatório

Marque **Tema aleatório a cada geração** no estúdio, ou use `--tema aleatorio`
no terminal. Serve para quem publica várias listas por dia e não quer escolher
paleta toda vez.

A matiz avança pelo **ângulo áureo** (137,5°) a partir de um contador guardado
no navegador, não por sorteio uniforme: assim dois catálogos seguidos ficam
sempre a 137° um do outro no círculo de cores, enquanto sortear ao acaso
repetiria vizinhança com frequência incômoda. Família e estilo rodam em ciclos
de tamanhos diferentes, então as 16 combinações aparecem antes de repetir.

O tema sorteado aparece no resumo (`tema: Turquesa vibrante (bloco)`), e
`--semente N` reproduz um sorteio específico.

#### A garantia de legibilidade

`tests/temas.test.mjs` mede cada par que aparece na página pela fórmula da WCAG,
com o piso escolhido pelo tamanho real do elemento: 3.0 para preço e título, que
são grandes, e 4.5 para selo, pílula, nome e faixa de seção. Gradientes são
avaliados parada a parada e vale a pior.

O teste cobre os 121 temas do catálogo **e** varre o gerador em 36 matizes × 4
famílias × 4 estilos — 576 paletas. Isso importa porque o sorteio pode produzir
qualquer matiz, não só as 26 da lista fixa.

Não é zelo excessivo: na primeira execução o teste reprovou sete das paletas
curadas, incluindo o preço do `noite`, que estava em 2.77 e já tinha sido
entregue.

### O cabeçalho

Cada linha é substituível e some quando fica vazia: `--titulo`, `--sobretitulo`,
`--data`, `--sem-data`, `--sem-subtitulo`. O que o parser leu da lista é ponto
de partida, não imposição. Cabeçalho totalmente vazio não reserva altura — a
tabela ocupa a página inteira.

Quando uma entrada gera vários catálogos (a lista da Apple gera dois),
`--titulo` renomeia todos. Para títulos diferentes, rode um de cada vez.

### O marcador de lançamento

Por padrão o catálogo **reproduz a palavra como você escreveu** — quem digitou
`LANÇAMENTO - Redmi 15C` vê `LANÇAMENTO Redmi 15C`, só com realce de cor.
Inventar um rótulo que o autor não escreveu é decisão dele, não do código.

- `--selo NOVO` troca a palavra por uma cápsula destacada com esse texto.
- `--remover "LANÇAMENTO"` faz sumir de vez.

### Ajustes de apresentação

Três opções que não mudam o que foi lido, só como aparece:

- **`--remover`** tira palavras do nome. Serve para o que se repete em toda
  linha e o título já diz: `--remover "Smart TV"` limpa as 14 linhas da lista de
  TVs. Ignora acento e caixa, casa palavra inteira (`TV` não come o `TV` de
  `TVS`), aceita frase (`Tomada/Carregador`) e costura o que sobra. Se remover
  tudo, o nome original volta — linha sem identificação seria pior.
- **`--alinhar-*`** controla cada coluna. O padrão é nome à esquerda, cor e
  preço centralizados. Com nomes curtos a coluna de nome sobra e o texto fica
  longe do preço; `--alinhar-nome direita` encosta os dois.
- **`--margens stories`** reserva a faixa que o Instagram e o WhatsApp cobrem
  com a própria interface — foto de perfil no topo, campo de resposta embaixo.
  Custa ~30% da altura, e é a diferença entre o catálogo ser lido e sair
  cortado. As margens são px absolutos, não multiplicados por `--escala`: o
  recorte acontece em pixels da imagem final, então uma margem que encolhesse
  junto com a tabela deixaria de proteger justamente nas listas maiores.

## Decisões tomadas

1. **Preço nunca é arredondado.** `999,99` sai como `999,99`.

2. **A foto compõe o fundo da página**, não é imagem de produto. Cada tema traz
   um véu (`--foto-veu`) aplicado por cima — sem ele o texto some sobre a foto.
   No terminal é `--fundo-imagem`; no estúdio, um seletor de arquivo.

3. **Produto com um preço só repete o valor** nas duas colunas, em vez de deixar
   uma com um traço. Vale para fone, carregador e afins.

4. **Um catálogo é sempre uma imagem só.** Os 42 celulares cabem numa página,
   comprimindo a tabela até caber. Se quiser dividir, use `--paginas-max 2`.

Duas coisas foram necessárias para o item 4 não ficar estranho:

- **O cabeçalho tem escala própria** (`escalaCabecalho`, em `template.js`). A
  tabela comprime até 0,36; o título para em 0,78. Sem isso o catálogo perderia
  a chamada e viraria planilha.
- **A sublinha "10x 76,00" só aparece quando o produto foge do parcelamento
  dominante.** O cabeçalho da coluna já diz "em até 10x", então repetir em toda
  linha é redundante — e custava ~11 px cada, o que na lista de celulares era
  exatamente a diferença entre uma página e duas.

Fonte, tamanho de coluna e preço têm **piso em pixels**: numa lista longa a
escala cai muito, e sem piso o preço encolheria junto com a linha. A paginação
já contabiliza a altura resultante do piso.

### A tipografia

Inter vem **embutida em base64** (`src/render/fonte.css`, 48 KB de woff2, subset
latino, variável 100–900). Não é preciosismo: a fonte precisa estar embutida
porque a exportação PNG do navegador embrulha a página num SVG, e SVG não busca
arquivo externo — fonte referenciada por URL sairia sem estilo na imagem. De
quebra, o catálogo fica idêntico em qualquer máquina, em vez de virar Segoe UI
no Windows e outra coisa no celular.

Dois detalhes que custaram:

- **A fonte é carregada antes de paginar.** A paginação mede texto no DOM; medir
  com a fonte de reserva daria altura errada e página estourada. Por isso
  `palco.html` só publica `window.__gc` depois do `document.fonts.ready`, e o
  estúdio espera a mesma promessa antes de gerar.
- **`font-feature-settings: 'calt' 0`.** Ligadas, as alternativas contextuais da
  Inter trocam o "x" entre dígitos pelo sinal de multiplicação, e
  "Realme Note 60x" saía como "Note 60×". Em nome de modelo isso é erro.

Emoji fica fora do subset de propósito: o `unicode-range` deixa os emojis caírem
para a fonte do sistema, que é quem sabe desenhá-los.

### A ordem dos produtos

Fica **como você escreveu**, e isso é decisão, não omissão. A sua ordem carrega
informação que uma ordenação automática destruiria: a lista de TVs sobe por
polegada (32", 40", 43", 50"...), a de celulares agrupa por marca e progride por
geração. Ordenar por preço embaralharia as duas.

## Testes

```bash
npm test
```

`tests/parse.test.mjs` roda o parser contra as quatro listas reais de `samples/`
— conta produtos, confere preços e cores caso a caso.

`tests/estudio.test.mjs` abre o `index.html` num Chromium, gera o catálogo e
verifica quatro coisas: que os 42 celulares cabem em **uma** página, que os 42
produtos continuam desenhados (caber não pode virar cortar), que **nenhuma linha
vaza da página** e que a **Inter embutida está mesmo em uso** — se cair na fonte
de reserva, as medidas mudam e o catálogo sai diferente em cada máquina. É o
teste que pega regressão de CSS.

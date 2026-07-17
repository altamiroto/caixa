package br.ufmg.dees.insane.ui.rich.solution; // pacote dos mains de teste da pesquisa (mesmo lugar dos testes da Karla)

import br.ufmg.dees.insane.model.femmodel.node.Node; // classe base de no; usada para as chaves DOF_LABELS/RESTRAINTS
import br.ufmg.dees.insane.model.igamodel.model.IgaModel; // modelo isogeometrico (guarda pontos de controle, knots, grau)
import br.ufmg.dees.insane.model.igamodel.node.IgaControlPoint; // ponto de controle IGA (tem peso, alem de coordenadas)
import br.ufmg.dees.insane.model.igamodel.refinament.HRefinament2D; // refinamento h (insercao de no) da Karla - alvo do teste
import br.ufmg.dees.insane.model.igamodel.refinament.Mesh2D; // monta a incidencia dos elementos apos o refinamento
import br.ufmg.dees.insane.persistence.PersistenceAsXml; // contem fillRefinedModel (o fluxo acionado pelo XML)
import br.ufmg.dees.insane.util.geometry.IPoint3d; // ponto 3D (x,y,z) usado como coordenada do ponto de controle
import br.ufmg.dees.insane.util.linearalgebra.IMatrix; // matriz do INSANE (usada para coordenadas e incidencia)
import br.ufmg.dees.insane.util.linearalgebra.IVector; // vetor do INSANE (usado para knot vectors, pesos, nos a inserir)
import br.ufmg.dees.insane.util.pointvalues.BooleanPointValues; // lista de valores booleanos por no (restricoes true/false)
import br.ufmg.dees.insane.util.pointvalues.StringPointValues; // lista de rotulos por no (ex.: "Dx", "Dy")

/**
 * Teste do refinamento por insercao de nos (h-refinement) existente no
 * INSANE, em tres niveis:
 *
 * (1) a classe HRefinament2D isolada (makeHRefinament2D e
 *     makeHRefinament2DNovo), para varios tipos de knot vector;
 * (2) o fluxo completo PersistenceAsXml.fillRefinedModel(), que e o caminho
 *     acionado pelo XML (PRefinament / KnotsToBeInsertedX/Y);
 * (3) a remontagem de elementos (Mesh2D.mountMesh) confrontada com os
 *     operadores de extracao de Bezier do IgaModel.
 *
 * Criterio de aprovacao: a insercao de nos NAO pode alterar a geometria.
 * A superficie refinada e comparada ponto a ponto com a original em uma
 * grade 41x41, usando um avaliador NURBS independente (findSpan + funcoes
 * de base, algoritmos A2.1/A2.2 do NURBS Book, implementado no fim desta
 * classe); erro maximo <= 1E-9 = geometria preservada.
 *
 * Nao depende de nenhuma classe alem das ja existentes no INSANE.
 * Executar como Java Application (Run As no Eclipse) - sem argumentos.
 *
 * @author Altamiro J. M. Silva
 */
public class TesteRefinamentoIga { // classe de teste; nome padrao "Teste..." do grupo

  private static int falhas = 0; // contador global de casos reprovados; static porque os metodos de teste tambem sao static

  public static void main(String[] args) { // ponto de entrada; "Run As -> Java Application" chama este metodo

    System.out.println("=============================================================="); // moldura visual do relatorio
    System.out.println(" TESTE DO REFINAMENTO POR INSERCAO DE NOS (h-refinement) "); // titulo do relatorio
    System.out.println("=============================================================="); // fecha a moldura do titulo
    System.out.println(); // linha em branco para separar o cabecalho

    // =====================================================================
    // Malhas de teste
    // =====================================================================

    // (a) malha SUAVE: knot vector uniforme, pesos = 1, grade regular
    double[] knotsUnif = {0, 0, 0, 1.0 / 3.0, 2.0 / 3.0, 1, 1, 1}; // knot vector p=2 aberto, 2 spans internos -> 5 CPs por direcao
    double[][] xyUnif = new double[25][2]; // 5x5 = 25 pontos de controle, cada um com (x,y)
    double[] wUnif = new double[25]; // 25 pesos (um por ponto de controle)
    for (int j = 0; j < 5; j++) { // j percorre as 5 linhas (direcao eta)
      for (int i = 0; i < 5; i++) { // i percorre as 5 colunas (direcao csi)
        xyUnif[j * 5 + i][0] = i + 0.1 * j; // x = coluna + leve inclinacao com a linha (grade nao trivial)
        xyUnif[j * 5 + i][1] = j + 0.05 * i; // y = linha + leve inclinacao com a coluna
        wUnif[j * 5 + i] = 1.0; // peso 1 em todos -> caso B-spline "suave" (nao racional)
      }
    }

    // (b) patch de Bezier UNICO com pesos racionais (quarto de anel exato)
    double[] knotsBezier = {0, 0, 0, 1, 1, 1}; // knot vector p=2 SEM nos internos -> 3 CPs, 1 unico elemento (Bezier)
    double s45 = Math.sqrt(0.5); // peso do CP do meio de um arco de 90 graus exato = sen(45) = raiz(1/2)
    double[][] xyAnel = new double[9][2]; // 3x3 = 9 pontos de controle
    double[] wAnel = new double[9]; // 9 pesos
    double[][] ring = {{1, 0}, {1, 1}, {0, 1}}; // 3 CPs do arco unitario: inicio, canto, fim (forma de L, exato com o peso s45)
    double[] wRing = {1, s45, 1}; // pesos do arco: 1 nas pontas, s45 no canto (torna o arco um circulo exato)
    double[] raios = {1.0, 1.5, 2.0}; // 3 aneis a raios diferentes (extrusao radial do arco em eta)
    for (int j = 0; j < 3; j++) { // j percorre os 3 aneis (direcao eta)
      for (int i = 0; i < 3; i++) { // i percorre os 3 CPs do arco (direcao csi)
        xyAnel[j * 3 + i][0] = ring[i][0] * raios[j]; // x = x do arco unitario escalado pelo raio do anel
        xyAnel[j * 3 + i][1] = ring[i][1] * raios[j]; // y = y do arco unitario escalado pelo raio do anel
        wAnel[j * 3 + i] = wRing[i]; // peso depende so da posicao no arco (mesmo para todos os aneis)
      }
    }

    // (c) malha REAL da pesquisa: meio dominio da chapa com furo - knot
    // vector NAO uniforme com nos interiores repetidos (mult = 2), pesos
    // racionais e KnotVectorX != KnotVectorY (9 x 3 pontos de controle)
    double[] knotsFuroU = {0, 0, 0, 0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1, 1}; // csi: 4 arcos de 90, cada no interno com mult 2 (C0) -> 9 CPs
    double[] knotsFuroV = {0, 0, 0, 1, 1, 1}; // eta: 1 unico span -> 3 CPs; note que e DIFERENTE de knotsFuroU
    double t22 = Math.sqrt(2.0) - 1.0; // tan(22.5 graus) = raiz(2)-1; coordenada exata dos CPs "de canto" do circulo unitario
    double wc = (1.0 + s45) / 2.0; // peso do anel do meio: media homogenea entre peso do arco (s45) e 1
    double[][] inner = {{0, 1}, {-t22, 1}, {-s45, s45}, {-1, t22}, {-1, 0}, // 9 CPs do circulo unitario (furo), meio dominio
                        {-1, -t22}, {-s45, -s45}, {-t22, -1}, {0, -1}}; // ... continuacao dos 9 CPs (segunda metade do arco)
    double[] wInner = {1, wc, wc, wc, 1, wc, wc, wc, 1}; // pesos do anel interno: 1 nos pontos cardeais, wc nos intermediarios
    double[][] outer = {{0, 4}, {-2, 4}, {-4, 4}, {-4, 2}, {-4, 0}, // 9 CPs do contorno externo (quadrado 4x4, meio dominio)
                        {-4, -2}, {-4, -4}, {-2, -4}, {0, -4}}; // ... continuacao do contorno externo
    double[][] xyFuro = new double[27][2]; // 9 (csi) x 3 (eta) = 27 pontos de controle
    double[] wFuro = new double[27]; // 27 pesos
    for (int i = 0; i < 9; i++) { // i percorre os 9 CPs de cada anel na direcao csi
      xyFuro[i] = inner[i]; // anel 0 (interno): borda do furo
      wFuro[i] = wInner[i]; // pesos do anel interno
      double wMid = (wInner[i] + 1.0) / 2.0; // peso do anel do meio para esta coluna (media entre interno e externo)
      xyFuro[9 + i] = new double[] { // anel 1 (meio): posicao vinda da media HOMOGENEA (peso*coord) entre interno e externo
          (inner[i][0] * wInner[i] + outer[i][0]) / (2.0 * wMid), // x_meio = (x_int*w_int + x_ext*1) / (2*w_meio)
          (inner[i][1] * wInner[i] + outer[i][1]) / (2.0 * wMid)}; // y_meio = (y_int*w_int + y_ext*1) / (2*w_meio)
      wFuro[9 + i] = wMid; // peso do anel do meio
      xyFuro[18 + i] = outer[i]; // anel 2 (externo): contorno quadrado
      wFuro[18 + i] = 1.0; // contorno externo e poligonal -> peso 1
    }

    // =====================================================================
    // Nivel 1 - HRefinament2D isolada
    // =====================================================================
    System.out.println("--- Nivel 1: HRefinament2D isolada ------------------------------"); // cabecalho do nivel 1

    kernel("1.1 uniforme, pesos=1, dir=1, no 0.5, makeHRefinament2D (original)", // caso controle: B-spline simples, metodo original
        2, knotsUnif, knotsUnif, xyUnif, wUnif, 1, 0.5, false); // p=2, knots iguais, dir=1 (csi), insere 0.5, novo=false
    kernel("1.2 uniforme, pesos=1, dir=1, no 0.5, makeHRefinament2DNovo", // mesmo caso, versao homogenea "Novo"
        2, knotsUnif, knotsUnif, xyUnif, wUnif, 1, 0.5, true); // novo=true
    kernel("1.3 uniforme, pesos=1, dir=2, no 0.5, makeHRefinament2DNovo", // insercao na direcao eta (dir=2)
        2, knotsUnif, knotsUnif, xyUnif, wUnif, 2, 0.5, true); // dir=2
    kernel("1.4 pesos racionais (anel), dir=1, no 0.5, makeHRefinament2D (original)", // pesos != 1 no metodo cartesiano original
        2, knotsBezier, knotsBezier, xyAnel, wAnel, 1, 0.5, false); // esperado FALHAR (interpola em coord. cartesianas)
    kernel("1.5 pesos racionais (anel), dir=1, no 0.5, makeHRefinament2DNovo", // mesmos pesos racionais, versao homogenea
        2, knotsBezier, knotsBezier, xyAnel, wAnel, 1, 0.5, true); // esperado PASSAR
    kernel("1.6 chapa c/ furo (nao unif., mult=2), dir=1, no 0.125, Novo", // knot nao uniforme com no repetido, insere no span [0,0.25]
        2, knotsFuroU, knotsFuroV, xyFuro, wFuro, 1, 0.125, true); // dir=1
    kernel("1.7 chapa c/ furo, dir=1, no 0.6 (span [0.5,0.75]), Novo", // insere em outro span interno
        2, knotsFuroU, knotsFuroV, xyFuro, wFuro, 1, 0.6, true); // dir=1
    kernel("1.8 chapa c/ furo, dir=2 (KnotVectorX != KnotVectorY), no 0.5, Novo", // insere em eta, com knots X e Y diferentes
        2, knotsFuroU, knotsFuroV, xyFuro, wFuro, 2, 0.5, true); // dir=2

    // =====================================================================
    // Nivel 2 - fluxo completo: PersistenceAsXml.fillRefinedModel()
    // (o caminho acionado pelo XML via PRefinament / KnotsToBeInsertedX/Y)
    // =====================================================================
    System.out.println(); // separador
    System.out.println("--- Nivel 2: fluxo fillRefinedModel -----------------------------"); // cabecalho do nivel 2

    fluxo("2.1 patch de Bezier UNICO (3x3, knots 0 0 0 1 1 1), nos 0.5 em X e Y", // caso onde o fluxo funciona (patch unico)
        xyAnel, wAnel, knotsBezier, knotsBezier, // malha do anel, knots iguais
        new double[] {0.5}, new double[] {0.5}, 16); // insere 0.5 em X e em Y -> 4x4 = 16 CPs esperados
    fluxo("2.2 uniforme 5x5 (2 elementos por direcao, X = Y), nos 0.5 em X e Y", // malha com 2 elementos/direcao (nao e patch unico)
        xyUnif, wUnif, knotsUnif, knotsUnif, // malha uniforme, knots iguais
        new double[] {0.5}, new double[] {0.5}, 36); // esperava 6x6 = 36; o fluxo produz NaN aqui
    fluxo("2.3 chapa c/ furo (X != Y, mult=2), no 0.125 em X", // malha real da pesquisa
        xyFuro, wFuro, knotsFuroU, knotsFuroV, // knots X e Y diferentes
        new double[] {0.125}, new double[] {}, 30); // insere so em X; esperava 10x3 = 30; o fluxo lanca excecao

    // =====================================================================
    // Nivel 3 - Mesh2D x operadores de extracao (nos interiores repetidos)
    // A malha refinada e obtida com a propria HRefinament2D (caso 1.6).
    // =====================================================================
    System.out.println(); // separador
    System.out.println("--- Nivel 3: Mesh2D x operadores de extracao --------------------"); // cabecalho do nivel 3

    try { // protege o bloco: se algo lancar excecao, contamos como falha em vez de abortar o programa
      HRefinament2D ref = new HRefinament2D(); // instancia o refinamento da Karla
      ref.setDir(1); // insercao na direcao csi
      ref.setDimension(2); // problema 2D (x,y)
      ref.setPoly(2); // grau 2 nas duas direcoes
      ref.setKnotIns(0.125); // no a inserir (dentro do span [0, 0.25])
      ref.setKnotVectorOldXi(paraIVector(knotsFuroU)); // knot vector csi original (convertido para IVector)
      ref.setKnotVectorOldEta(paraIVector(knotsFuroV)); // knot vector eta original
      IMatrix pW = new IMatrix(27, 2); // matriz 27x2 das coordenadas dos pontos de controle
      IVector pesos = new IVector(27); // vetor dos 27 pesos
      for (int i = 0; i < 27; i++) { // copia coordenadas e pesos da malha da chapa para as estruturas do INSANE
        pW.setElement(i, 0, xyFuro[i][0]); // coluna 0 = x
        pW.setElement(i, 1, xyFuro[i][1]); // coluna 1 = y
        pesos.setElement(i, wFuro[i]); // peso do ponto i
      }
      ref.setCoordinates(pW); // entrega as coordenadas ao refinador
      ref.setWeights(pesos); // entrega os pesos ao refinador
      ref.makeHRefinament2DNovo(); // executa a insercao de no (versao homogenea) -> gera a malha refinada

      Mesh2D mesh = new Mesh2D(); // classe que monta a incidencia (quais CPs formam cada elemento)
      mesh.setControlPointsNew(ref.getControlPointsNew()); // recebe os CPs refinados
      mesh.setPoly(2); // grau 2
      mesh.setKnotVectorNewXi(ref.getKnotVectorNewXi()); // knot vector csi refinado
      mesh.setKnotVectorNewEta(ref.getKnotVectorNewEta()); // knot vector eta refinado
      java.io.PrintStream out = System.out; // guarda a saida padrao atual para restaurar depois
      System.setOut(new java.io.PrintStream(new java.io.OutputStream() { // redireciona System.out para o "vazio"...
        public void write(int b) { // ...descartando cada byte escrito...
        }
      })); // ...porque o mountMesh imprime a matriz de incidencia e polui o relatorio
      IMatrix incidencia = mesh.mountMesh(); // monta a incidencia; retorna matriz [numElementos x (p+1)^2]
      System.setOut(out); // restaura a saida padrao

      IgaModel modeloOperadores = new IgaModel(); // modelo so para calcular os operadores de extracao de Bezier
      modeloOperadores.setPoly(2); // grau 2
      modeloOperadores.setKnotVectorX(ref.getKnotVectorNewXi()); // usa os mesmos knots refinados
      modeloOperadores.setKnotVectorY(ref.getKnotVectorNewEta()); // idem para eta
      modeloOperadores.getExtractionOperatorBivariate(); // calcula um operador cE por elemento REAL (span nao degenerado)

      int spansReais = spansNaoDegenerados(paraArray(ref.getKnotVectorNewXi()), 2) // numero de elementos reais em csi...
          * spansNaoDegenerados(paraArray(ref.getKnotVectorNewEta()), 2); // ...vezes os de eta = total de elementos reais
      System.out.println("3.1 chapa c/ furo + no 0.125: elementos do Mesh2D = " // imprime a comparacao dos tres numeros
          + incidencia.getNumRow() + " | operadores de extracao (cEs) = " // quantos elementos o Mesh2D criou
          + modeloOperadores.getcEs().size() // quantos operadores de extracao existem
          + " | elementos reais (spans nao degenerados) = " + spansReais); // quantos elementos deveriam existir
      if (incidencia.getNumRow() == modeloOperadores.getcEs().size()) { // se os dois numeros batem, a numeracao e coerente
        System.out.println("    [OK] numeracao de elementos compativel com os cEs"); // aprovado
      } else { // se nao batem, ha desalinhamento (o Mesh2D conta spans degenerados como elementos)
        falhas++; // conta a falha
        System.out.println("    [FALHA] com nos repetidos o Mesh2D cria um elemento por span" // explica a causa...
            + " (inclusive os degenerados), mas os cEs so percorrem spans nao degenerados" // ...os cEs ignoram spans degenerados...
            + " -> cEs.get(l) desalinha/estoura no fillIgaElementsListFromFile"); // ...gerando erro na remontagem de elementos
      }
    } catch (Exception e) { // captura qualquer excecao do bloco do nivel 3
      falhas++; // conta como falha
      System.out.println("3.1 -> excecao: " + e); // imprime a excecao para diagnostico
    }

    // =====================================================================
    System.out.println(); // separador antes do resumo final
    System.out.println("=============================================================="); // moldura do resumo
    if (falhas == 0) { // se nenhum caso reprovou...
      System.out.println(" RESULTADO: refinamento existente OK em todos os casos."); // ...tudo passou
    } else { // se houve reprovacoes...
      System.out.println(" RESULTADO: " + falhas + " caso(s) em que o refinamento existente" // ...quantos casos falharam...
          + " nao preserva o modelo."); // ...e a mensagem
      System.out.println(" Casos aprovados delimitam o dominio de validade atual:"); // resume onde o refinamento funciona
      System.out.println("   - nucleo makeHRefinament2DNovo: qualquer knot vector (1 no por vez);"); // o kernel e geral
      System.out.println("   - fluxo fillRefinedModel: apenas patch unico de Bezier quadrado"); // o fluxo e restrito...
      System.out.println("     (knots 0..0 1..1, iguais em X e Y, nX = nY = p+1)."); // ...a este caso especifico
    }
    System.out.println("=============================================================="); // fecha a moldura
    System.exit(falhas == 0 ? 0 : 1); // encerra a JVM (0 = sucesso, 1 = falha) e finaliza threads do INSANE (ex.: IConsole/Swing)
  }

  // =======================================================================
  // Nivel 1: roda a HRefinament2D isolada e mede o erro geometrico
  // =======================================================================
  private static void kernel(String nome, int p, double[] knotsU, double[] knotsV, // metodo auxiliar do nivel 1
      double[][] xy, double[] w, int dir, double noInserido, boolean novo) { // recebe malha, direcao, no a inserir e qual variante

    AvaliadorNurbs original = new AvaliadorNurbs(p, p, knotsU, knotsV, xy, w); // guarda a superficie ORIGINAL (referencia)

    try { // protege contra excecoes durante o refinamento
      HRefinament2D ref = new HRefinament2D(); // instancia o refinador da Karla
      ref.setDir(dir); // direcao da insercao (1=csi, 2=eta)
      ref.setDimension(2); // 2D
      ref.setPoly(p); // grau
      ref.setKnotIns(noInserido); // valor do no a inserir
      ref.setKnotVectorOldXi(paraIVector(knotsU)); // knot vector csi original
      ref.setKnotVectorOldEta(paraIVector(knotsV)); // knot vector eta original
      IMatrix pW = new IMatrix(xy.length, 2); // matriz de coordenadas (n CPs x 2)
      IVector pesos = new IVector(xy.length); // vetor de pesos
      for (int i = 0; i < xy.length; i++) { // preenche coordenadas e pesos
        pW.setElement(i, 0, xy[i][0]); // x
        pW.setElement(i, 1, xy[i][1]); // y
        pesos.setElement(i, w[i]); // peso
      }
      ref.setCoordinates(pW); // entrega coordenadas
      ref.setWeights(pesos); // entrega pesos

      if (novo) { // escolhe qual metodo testar...
        ref.makeHRefinament2DNovo(); // ...versao homogenea (correta para pesos racionais)
      } else { // ...ou...
        ref.makeHRefinament2D(); // ...versao original (cartesiana)
      }

      double[] kU = paraArray(ref.getKnotVectorNewXi()); // knot vector csi apos a insercao (convertido para double[])
      double[] kV = paraArray(ref.getKnotVectorNewEta()); // knot vector eta apos a insercao
      int nCp = ref.getControlPointsNew().getNumRow(); // numero de CPs gerados
      int esperado = (kU.length - p - 1) * (kV.length - p - 1); // numero teorico de CPs = nU * nV (regra do knot vector)
      if (nCp != esperado) { // se o numero de CPs nao bate com o esperado...
        falhas++; // ...conta falha...
        System.out.println("[FALHA] " + nome + " -> " + nCp // ...e reporta os numeros
            + " pontos de controle (esperado " + esperado + ")"); // esperado vs obtido
        return; // aborta este caso
      }
      double[][] xyN = new double[nCp][2]; // coordenadas refinadas
      double[] wN = new double[nCp]; // pesos refinados
      boolean invalido = false; // marca se aparecer NaN ou peso <= 0
      for (int i = 0; i < nCp; i++) { // le os CPs refinados
        xyN[i][0] = ref.getControlPointsNew().getElement(i, 0); // x refinado
        xyN[i][1] = ref.getControlPointsNew().getElement(i, 1); // y refinado
        wN[i] = ref.getWeightsNew().getElement(i); // peso refinado
        if (Double.isNaN(xyN[i][0]) || Double.isNaN(xyN[i][1]) || wN[i] <= 0.0) { // deteccao de resultado invalido
          invalido = true; // marca invalido
        }
      }
      if (invalido) { // se houve NaN/peso invalido...
        falhas++; // ...conta falha...
        System.out.println("[FALHA] " + nome + " -> NaN / peso invalido nos pontos gerados"); // ...e reporta
        return; // aborta este caso
      }
      AvaliadorNurbs refinada = new AvaliadorNurbs(p, p, kU, kV, xyN, wN); // constroi a superficie REFINADA
      double erro = erroGeometrico(original, refinada); // compara original x refinada em uma grade
      boolean ok = erro < 1.0e-9; // criterio: erro abaixo de 1e-9 = geometria preservada
      if (!ok) { // se reprovou...
        falhas++; // ...conta falha
      }
      System.out.println((ok ? "[OK   ] " : "[FALHA] ") + nome // imprime OK ou FALHA...
          + " -> erro geometrico maximo = " + String.format("%.3e", erro)); // ...com o erro em notacao cientifica
    } catch (Exception e) { // qualquer excecao durante o refinamento...
      falhas++; // ...conta falha...
      System.out.println("[FALHA] " + nome + " -> excecao: " + e); // ...e reporta a excecao
    }
  }

  // =======================================================================
  // Nivel 2: monta um IgaModel e roda o fillRefinedModel de verdade
  // =======================================================================
  private static void fluxo(String nome, double[][] xy, double[] w, double[] knotsU, // metodo auxiliar do nivel 2
      double[] knotsV, double[] insX, double[] insY, int cpsEsperados) { // recebe malha, nos a inserir em X/Y e CPs esperados

    AvaliadorNurbs original = new AvaliadorNurbs(2, 2, knotsU, knotsV, xy, w); // superficie ORIGINAL de referencia

    try { // protege o bloco do fluxo real
      IgaModel modelo = new IgaModel(); // cria o modelo IGA que o fillRefinedModel vai refinar
      for (int i = 0; i < xy.length; i++) { // adiciona cada ponto de controle ao modelo
        IgaControlPoint cp = new IgaControlPoint(); // novo ponto de controle IGA
        IPoint3d coord = new IPoint3d(); // coordenada 3D
        coord.setX(xy[i][0]); // x
        coord.setY(xy[i][1]); // y
        coord.setZ(0); // z=0 (problema plano)
        cp.setPoint(coord); // atribui a coordenada ao CP
        cp.setControlPointWeight(w[i]); // atribui o peso
        cp.setLabel(Integer.toString(i + 1)); // rotulo "1".."n" (o INSANE numera a partir de 1)
        StringPointValues spv = new StringPointValues(); // lista de rotulos de grau de liberdade
        spv.addPointValue("Dx"); // deslocamento em x
        spv.addPointValue("Dy"); // deslocamento em y
        cp.setNodeValues(Node.DOF_LABELS, spv); // registra os DOFs no no (o fillRefinedModel espera isso)
        BooleanPointValues bpv = new BooleanPointValues(); // lista de restricoes (livre/preso) por DOF
        bpv.addPointValue(false); // Dx livre
        bpv.addPointValue(false); // Dy livre
        cp.setNodeValues(Node.RESTRAINTS, bpv); // registra as restricoes no no
        modelo.add(cp); // adiciona o CP ao modelo
      }
      modelo.setKnotVectorX(paraIVector(knotsU)); // knot vector csi do modelo
      modelo.setKnotVectorY(paraIVector(knotsV)); // knot vector eta do modelo
      modelo.setPoly(2); // grau 2
      modelo.setpRefinament(0); // sem elevacao de grau (p-refinement = 0)
      modelo.setKnotsToBeInsertedX(paraIVector(insX)); // nos a inserir em csi (aciona o h-refinement)
      modelo.setKnotsToBeInsertedY(paraIVector(insY)); // nos a inserir em eta

      PersistenceAsXml persistencia = new PersistenceAsXml(); // objeto que contem o fillRefinedModel
      persistencia.setModel(modelo); // injeta o modelo (como se tivesse sido lido do XML)

      // silencia os prints internos do fillRefinedModel
      java.io.PrintStream out = System.out; // guarda a saida padrao
      System.setOut(new java.io.PrintStream(new java.io.OutputStream() { // redireciona para o vazio...
        public void write(int b) { // ...descartando cada byte...
        }
      })); // ...pois o fluxo imprime muitas matrizes internas
      try { // garante a restauracao da saida mesmo se der excecao
        persistencia.fillRefinedModel(); // EXECUTA o refinamento do fluxo real (o mesmo acionado pelo XML)
      } finally { // sempre executa, com ou sem excecao
        System.setOut(out); // restaura a saida padrao
      }

      int nX = modelo.getKnotVectorX().getSize() - 2 - 1; // numero de CPs em csi apos o refino = (tamanho knots) - p - 1
      int nY = modelo.getKnotVectorY().getSize() - 2 - 1; // numero de CPs em eta apos o refino
      int nCp = modelo.getNodesList().size(); // numero de CPs realmente presentes no modelo apos o fluxo

      if (nCp != cpsEsperados || nX * nY != nCp) { // se o total nao bate com o esperado OU com nX*nY (malha inconsistente)...
        falhas++; // ...conta falha...
        System.out.println("[FALHA] " + nome + " -> " + nCp + " pontos de controle (esperado " // ...e reporta os numeros...
            + cpsEsperados + "); knot vectors resultantes: X com " // ...esperado...
            + modelo.getKnotVectorX().getSize() + " nos, Y com " // ...tamanho do knot X...
            + modelo.getKnotVectorY().getSize() + " nos"); // ...tamanho do knot Y
        return; // aborta este caso
      }

      double[][] xyN = new double[nCp][2]; // coordenadas refinadas
      double[] wN = new double[nCp]; // pesos refinados
      boolean invalido = false; // marca NaN/peso invalido
      for (int i = 0; i < nCp; i++) { // le os CPs do modelo refinado
        xyN[i][0] = modelo.getNodesList().get(i).getX(); // x do CP i
        xyN[i][1] = modelo.getNodesList().get(i).getY(); // y do CP i
        wN[i] = ((IgaControlPoint) modelo.getNodesList().get(i)).getControlPointWeight(); // peso do CP i (cast para IgaControlPoint)
        if (Double.isNaN(xyN[i][0]) || Double.isNaN(xyN[i][1]) || Double.isNaN(wN[i]) // deteccao de invalidos...
            || wN[i] <= 0.0) { // ...inclui peso nulo/negativo
          invalido = true; // marca invalido
        }
      }
      if (invalido) { // se o fluxo produziu valores invalidos...
        falhas++; // ...conta falha...
        System.out.println("[FALHA] " + nome // ...e reporta
            + " -> NaN / peso invalido nos pontos de controle apos o fluxo"); // mensagem
        return; // aborta este caso
      }

      AvaliadorNurbs refinada = new AvaliadorNurbs(2, 2, // constroi a superficie refinada...
          paraArray(modelo.getKnotVectorX()), paraArray(modelo.getKnotVectorY()), xyN, wN); // ...com os knots e CPs do modelo
      double erro = erroGeometrico(original, refinada); // compara com a original
      boolean ok = erro < 1.0e-9; // criterio de geometria preservada
      if (!ok) { // se reprovou...
        falhas++; // ...conta falha
      }
      System.out.println((ok ? "[OK   ] " : "[FALHA] ") + nome // imprime OK/FALHA...
          + " -> erro geometrico maximo = " + String.format("%.3e", erro)); // ...com o erro
    } catch (Exception e) { // captura excecao do fluxo (ex.: ArrayIndexOutOfBounds do PRefinamentB)
      falhas++; // conta falha
      System.out.println("[FALHA] " + nome + " -> excecao: " + e); // reporta a excecao (mostra onde o fluxo quebra)
    }
  }

  private static double erroGeometrico(AvaliadorNurbs antes, AvaliadorNurbs depois) { // mede a diferenca geometrica entre 2 superficies
    double erro = 0; // maior distancia encontrada ate agora
    for (int i = 0; i <= 40; i++) { // 41 amostras em csi (0, 1/40, ..., 1)
      for (int j = 0; j <= 40; j++) { // 41 amostras em eta -> grade 41x41 = 1681 pontos
        double[] a = antes.pontoSuperficie(i / 40.0, j / 40.0); // ponto da superficie original nesse (u,v)
        double[] b = depois.pontoSuperficie(i / 40.0, j / 40.0); // ponto da superficie refinada no mesmo (u,v)
        erro = Math.max(erro, Math.hypot(a[0] - b[0], a[1] - b[1])); // distancia euclidiana; guarda a maxima
      }
    }
    return erro; // retorna o erro maximo (norma do infinito sobre a grade)
  }

  /** Numero de spans nao degenerados (elementos reais) de um knot vector. */
  private static int spansNaoDegenerados(double[] knots, int p) { // conta intervalos [u_i, u_{i+1}) com comprimento > 0
    int nCp = knots.length - p - 1; // numero de CPs = tamanho do knot vector - grau - 1
    int n = 0; // contador de spans validos
    for (int i = p; i < nCp; i++) { // percorre os spans internos (de p ate nCp-1), como faz o operador de extracao
      if (knots[i + 1] - knots[i] > 1.0e-12) { // se o span tem comprimento nao nulo (nao e no repetido)...
        n++; // ...conta como elemento real
      }
    }
    return n; // total de elementos reais
  }

  private static IVector paraIVector(double[] v) { // converte double[] para o IVector do INSANE
    IVector out = new IVector(v.length); // cria o IVector do tamanho certo
    for (int i = 0; i < v.length; i++) { // copia elemento a elemento
      out.setElement(i, v[i]); // posicao i recebe v[i]
    }
    return out; // devolve o IVector
  }

  private static double[] paraArray(IVector v) { // converte um IVector do INSANE de volta para double[]
    double[] out = new double[v.getSize()]; // array do tamanho do vetor
    for (int i = 0; i < v.getSize(); i++) { // copia elemento a elemento
      out[i] = v.getElement(i); // posicao i recebe v.getElement(i)
    }
    return out; // devolve o array
  }

  // =======================================================================
  // Avaliador NURBS independente (NURBS Book, algoritmos A2.1 e A2.2):
  // avalia S(u,v) em coordenadas homogeneas e projeta. Serve apenas para
  // MEDIR a geometria - nao participa do refinamento testado.
  // =======================================================================
  private static class AvaliadorNurbs { // avaliador de superficie NURBS, usado so como "regua" para medir a geometria

    private final int p; // grau na direcao csi
    private final int q; // grau na direcao eta
    private final double[] knotsU; // knot vector csi
    private final double[] knotsV; // knot vector eta
    private final double[][] pw; // pontos de controle em coordenadas HOMOGENEAS (w*x, w*y, w), ordem plana j*nU + i
    private final int nU; // numero de CPs em csi
    private final int nV; // numero de CPs em eta

    AvaliadorNurbs(int p, int q, double[] knotsU, double[] knotsV, double[][] xy, double[] w) { // construtor
      this.p = p; // guarda grau csi
      this.q = q; // guarda grau eta
      this.knotsU = knotsU.clone(); // copia defensiva do knot vector csi (evita alteracao externa)
      this.knotsV = knotsV.clone(); // copia defensiva do knot vector eta
      this.nU = knotsU.length - p - 1; // numero de CPs em csi = |knotsU| - p - 1
      this.nV = knotsV.length - q - 1; // numero de CPs em eta = |knotsV| - q - 1
      this.pw = new double[nU * nV][3]; // aloca os CPs homogeneos (3 componentes cada)
      for (int a = 0; a < nU * nV; a++) { // converte cada CP cartesiano em homogeneo
        pw[a][0] = xy[a][0] * w[a]; // primeira componente = w*x
        pw[a][1] = xy[a][1] * w[a]; // segunda componente = w*y
        pw[a][2] = w[a]; // terceira componente = w
      }
    }

    double[] pontoSuperficie(double u, double v) { // avalia o ponto fisico S(u,v) da superficie NURBS
      int spanU = findSpan(knotsU, p, nU, u); // acha o span (intervalo de knots) que contem u
      int spanV = findSpan(knotsV, q, nV, v); // acha o span que contem v
      double[] bu = basisFuns(spanU, u, p, knotsU); // funcoes de base nao nulas em u (p+1 valores)
      double[] bv = basisFuns(spanV, v, q, knotsV); // funcoes de base nao nulas em v (q+1 valores)
      double sx = 0.0; // acumulador de w*x
      double sy = 0.0; // acumulador de w*y
      double sw = 0.0; // acumulador de w (denominador da NURBS)
      for (int j = 0; j <= q; j++) { // percorre as q+1 funcoes de base em eta
        int vj = spanV - q + j; // indice global do CP nessa direcao
        for (int i = 0; i <= p; i++) { // percorre as p+1 funcoes de base em csi
          int ui = spanU - p + i; // indice global do CP nessa direcao
          double b = bu[i] * bv[j]; // funcao de base bivariada = produto das univariadas
          double[] cp = pw[vj * nU + ui]; // CP homogeneo correspondente (ordem plana)
          sx += b * cp[0]; // soma b*(w*x)
          sy += b * cp[1]; // soma b*(w*y)
          sw += b * cp[2]; // soma b*w
        }
      }
      return new double[] {sx / sw, sy / sw}; // projeta de volta ao cartesiano: (x,y) = (sx/sw, sy/sw)
    }

    /** NURBS Book, A2.1. */
    private static int findSpan(double[] knots, int degree, int nCp, double u) { // localiza o indice do span que contem u
      if (u >= knots[nCp]) { // se u esta no (ou alem do) fim do dominio...
        return nCp - 1; // ...retorna o ultimo span valido (caso de borda do algoritmo)
      }
      if (u <= knots[degree]) { // se u esta no (ou antes do) inicio do dominio...
        return degree; // ...retorna o primeiro span valido
      }
      int low = degree; // limite inferior da busca binaria
      int high = nCp; // limite superior da busca binaria
      int mid = (low + high) / 2; // ponto medio inicial
      while (u < knots[mid] || u >= knots[mid + 1]) { // enquanto u nao estiver no intervalo [knots[mid], knots[mid+1])...
        if (u < knots[mid]) { // se u esta a esquerda...
          high = mid; // ...reduz o limite superior
        } else { // se u esta a direita...
          low = mid; // ...aumenta o limite inferior
        }
        mid = (low + high) / 2; // recalcula o meio
      }
      return mid; // indice do span encontrado
    }

    /** NURBS Book, A2.2. */
    private static double[] basisFuns(int span, double u, int degree, double[] knots) { // funcoes de base B-spline nao nulas em u
      double[] funs = new double[degree + 1]; // saida: p+1 funcoes de base nao nulas
      double[] left = new double[degree + 1]; // vetor auxiliar "left" do algoritmo
      double[] right = new double[degree + 1]; // vetor auxiliar "right" do algoritmo
      funs[0] = 1.0; // funcao de base de grau 0 vale 1 no span
      for (int j = 1; j <= degree; j++) { // eleva o grau de 1 ate p (recorrencia de Cox-de Boor)
        left[j] = u - knots[span + 1 - j]; // distancia de u ao knot a esquerda
        right[j] = knots[span + j] - u; // distancia de u ao knot a direita
        double saved = 0.0; // termo carregado entre as iteracoes internas
        for (int r = 0; r < j; r++) { // atualiza cada funcao de base do nivel atual
          double temp = funs[r] / (right[r + 1] + left[j - r]); // fator comum da recorrencia
          funs[r] = saved + right[r + 1] * temp; // contribuicao a esquerda
          saved = left[j - r] * temp; // guarda a contribuicao a direita para a proxima iteracao
        }
        funs[j] = saved; // ultima funcao de base do nivel
      }
      return funs; // retorna as p+1 funcoes de base (somam 1 - particao da unidade)
    }
  }
}

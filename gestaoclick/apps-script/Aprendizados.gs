/**
 * Backend simples (Google Apps Script) para o painel de estoque JETA.
 *
 * Guarda os vínculos "texto da lista ↔ produto do sistema" numa aba do
 * Google Sheets, para que o aprendizado feito em um dispositivo (ex.:
 * escolher manualmente qual produto corresponde a um item da lista)
 * fique disponível nos outros dispositivos também.
 *
 * Este script NUNCA toca no sistema da loja (gestaoclick/Bétel) — ele só
 * lê e escreve nesta planilha.
 *
 * COMO IMPLANTAR:
 * 1. Crie uma planilha nova em https://sheets.google.com.
 * 2. Nela, vá em Extensões > Apps Script.
 * 3. Apague o conteúdo padrão do arquivo Code.gs e cole todo este arquivo.
 * 4. Clique em "Implantar" > "Nova implantação".
 *    - Tipo: "App da Web"
 *    - Executar como: "Eu" (sua conta)
 *    - Quem pode acessar: "Qualquer pessoa"
 * 5. Autorize as permissões pedidas (é a sua própria planilha, é seguro).
 * 6. Copie a URL gerada (termina em /exec) e cole no painel de estoque,
 *    em "🧠 Aprendizados" > "Sincronização entre dispositivos".
 *
 * Sempre que você editar este script, gere uma NOVA implantação (ou use
 * "Gerenciar implantações" > editar > Nova versão) para as mudanças
 * valerem na URL já em uso.
 */

const ABA = 'aliases';

// IMPORTANTE: nunca usar vírgula como separador de lista dentro de uma
// célula. Em planilhas com locale pt-BR (Brasil), a VÍRGULA é o separador
// DECIMAL — então "95251769,84" (dois IDs excluídos juntados por vírgula)
// é lido pelo Sheets como o número 95251769.84, corrompendo os dois IDs
// numa coisa só. Ponto e vírgula nunca é confundido com número.
const SEP_LISTA = ';';

function _planilha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ABA);
  if (!sheet) {
    sheet = ss.insertSheet(ABA);
    sheet.appendRow(['key', 'produtoId', 'nome', 'exemplo', 'aprendidoEm', 'excluidos']);
  }
  // Reforço extra: força as colunas de ID a serem sempre texto, nunca
  // número. Sem isso, um produtoId só de dígitos (ex.: "9525176984")
  // também corre risco de virar Number e formatar/arredondar diferente
  // do valor original quando a planilha exibir/recalcular a célula.
  sheet.getRange('B2:B').setNumberFormat('@');
  sheet.getRange('F2:F').setNumberFormat('@');
  return sheet;
}

function _saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// GET → devolve todos os vínculos aprendidos, no mesmo formato usado
// no localStorage do painel:
// { [chave]: {id, nome, exemplo, aprendidoEm, excluidos: [ids]} }
// "excluidos" são produtos marcados como "nunca sugerir" para essa chave.
function doGet(e) {
  const sheet = _planilha();
  const valores = sheet.getDataRange().getValues();
  valores.shift(); // remove cabeçalho
  const map = {};
  valores.forEach(function (l) {
    if (!l[0]) return;
    const excluidosStr = (l[5] || '').toString();
    map[l[0]] = {
      id: (l[1] === '' || l[1] === null) ? '' : l[1].toString(),
      nome: l[2], exemplo: l[3], aprendidoEm: l[4],
      excluidos: excluidosStr ? excluidosStr.split(SEP_LISTA).map(function (s) { return s.trim(); }).filter(Boolean) : []
    };
  });
  return _saida({ ok: true, aliases: map });
}

// POST → { action: 'set', key, id, nome, exemplo, aprendidoEm, excluidos: [ids] }
//         { action: 'delete', key }
//         { action: 'clear' }
// Observação: o painel envia como Content-Type "text/plain" de propósito,
// para evitar o preflight CORS que o Apps Script não trata bem. O corpo
// continua sendo um JSON normal, só o header muda.
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    const acao = body.action;
    const sheet = _planilha();

    if (acao === 'clear') {
      const ultimaLinha = sheet.getLastRow();
      if (ultimaLinha > 1) sheet.deleteRows(2, ultimaLinha - 1);
      return _saida({ ok: true });
    }

    const dados = sheet.getDataRange().getValues();
    let linhaExistente = -1;
    for (let i = 1; i < dados.length; i++) {
      if (dados[i][0] === body.key) { linhaExistente = i + 1; break; }
    }

    if (acao === 'delete') {
      if (linhaExistente > 0) sheet.deleteRow(linhaExistente);
      return _saida({ ok: true });
    }

    if (acao === 'set') {
      const excluidosStr = Array.isArray(body.excluidos) ? body.excluidos.join(SEP_LISTA) : (body.excluidos || '');
      // As colunas B e F já foram forçadas para "Texto simples" em
      // _planilha() (setNumberFormat('@')) — é isso que garante que o
      // Sheets nunca tente interpretar o valor como número/data, sem
      // precisar de truques de prefixo que poderiam sujar o valor salvo.
      const linha = [
        body.key,
        (body.id === undefined || body.id === null) ? '' : String(body.id),
        body.nome,
        body.exemplo || '',
        body.aprendidoEm || new Date().toISOString(),
        excluidosStr
      ];
      if (linhaExistente > 0) {
        sheet.getRange(linhaExistente, 1, 1, linha.length).setValues([linha]);
      } else {
        sheet.appendRow(linha);
      }
      return _saida({ ok: true });
    }

    return _saida({ ok: false, erro: 'Ação desconhecida: ' + acao });
  } catch (err) {
    return _saida({ ok: false, erro: String(err) });
  } finally {
    lock.releaseLock();
  }
}

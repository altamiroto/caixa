export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,access-token,secret-access-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
  const SECRET_TOKEN = process.env.SECRET_TOKEN;
  if (!ACCESS_TOKEN || !SECRET_TOKEN) {
    return res.status(500).json({ code:500, status:'error', data:{ mensagem:'Tokens não configurados.' }});
  }

  const { loja_id, pagina = '1', nome = '', grupo_id } = req.query;

  const urlApi = new URL('https://api.beteltecnologia.com/produtos');
  urlApi.searchParams.append('pagina', String(pagina));
  if (loja_id) urlApi.searchParams.append('loja_id', loja_id);
  if (nome) urlApi.searchParams.append('nome', nome);

  // Trata filtro de grupos: aceita "grupo_id" como '1' ou '1,2,3' ou array
  if (grupo_id) {
    // se veio como array (ex.: ?grupo_id=1&grupo_id=2) ou string com vírgula
    const ids = Array.isArray(grupo_id) ? grupo_id.flatMap(x=>String(x).split(',')).map(s=>s.trim()).filter(Boolean)
               : String(grupo_id).split(',').map(s=>s.trim()).filter(Boolean);
    if (ids.length === 1) {
      urlApi.searchParams.append('grupo_id', ids[0]);
    } else if (ids.length > 1) {
      // envia both: csv e repetindo com 'grupo_id[]' — aumenta chance de compatibilidade
      urlApi.searchParams.append('grupo_id', ids.join(','));
      ids.forEach(id => urlApi.searchParams.append('grupo_id[]', id));
    }
  }

  try {
    const resp = await fetch(urlApi.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': ACCESS_TOKEN,
        'secret-access-token': SECRET_TOKEN
      }
    });

    if (!resp.ok) {
      const erro = await resp.json().catch(()=>({}));
      return res.status(resp.status).json({ code:resp.status, status:'error', data:erro || { mensagem:'Erro na API externa' }});
    }

    const dados = await resp.json();
    return res.status(200).json(dados);
  } catch (error) {
    return res.status(500).json({ code:500, status:'error', data:{ mensagem: 'Erro interno: ' + error.message }});
  }
}

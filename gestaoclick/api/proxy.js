export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,access-token,secret-access-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Este painel é apenas consultivo: nenhuma escrita no sistema é permitida.
  if (req.method !== 'GET') {
    return res.status(405).json({
      code: 405,
      status: 'error',
      data: { mensagem: 'Este proxy é somente leitura (GET). Método não permitido: ' + req.method }
    });
  }

  const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
  const SECRET_TOKEN = process.env.SECRET_TOKEN;

  if (!ACCESS_TOKEN || !SECRET_TOKEN) {
    return res.status(500).json({
      code: 500,
      status: 'error',
      data: { mensagem: 'Tokens não configurados.' }
    });
  }

  // Recebe a rota desejada via query 'rota', ex: grupos_produtos
  const { rota, ...params } = req.query;

  if (!rota) {
    return res.status(400).json({
      code: 400,
      status: 'error',
      data: { mensagem: 'Parâmetro "rota" é obrigatório.' }
    });
  }

  const urlApi = new URL(`https://api.beteltecnologia.com/${rota}`);

  // Passa todos os outros parâmetros para a API original
  Object.entries(params).forEach(([key, value]) => {
    urlApi.searchParams.append(key, value);
  });

  try {
    const fetchOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': ACCESS_TOKEN,
        'secret-access-token': SECRET_TOKEN,
      },
    };

    // Propaga loja_id para o cabeçalho caso a API exija
    if (params.loja_id) {
      fetchOptions.headers['loja_id'] = params.loja_id;
      fetchOptions.headers['loja-id'] = params.loja_id; // Variação com hífen por segurança
    }

    const resposta = await fetch(urlApi.toString(), fetchOptions);

    if (!resposta.ok) {
      const textoErro = await resposta.text().catch(() => 'Indisponível');
      let erroObj;
      try { erroObj = JSON.parse(textoErro); } catch (e) { erroObj = { mensagem: textoErro }; }

      return res.status(resposta.status).json({
        code: resposta.status,
        status: 'error',
        data: erroObj,
        debug: { url: urlApi.toString(), method: 'GET' }
      });
    }

    const dados = await resposta.json();
    return res.status(200).json(dados);
  } catch (error) {
    return res.status(500).json({
      code: 500,
      status: 'error',
      data: { mensagem: 'Erro interno: ' + error.message },
    });
  }
}

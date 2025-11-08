export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,access-token,secret-access-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
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

  // CORREÇÃO: Define a rota fixamente como 'produtos'
  const rota = 'produtos'; 
  const { ...params } = req.query; // Captura todos os outros parâmetros (loja_id, pagina, etc.)

  const urlApi = new URL(`https://api.beteltecnologia.com/${rota}`);

  // Passa todos os outros parâmetros para a API original
  Object.entries(params).forEach(([key, value]) => {
    urlApi.searchParams.append(key, value);
  });

  try {
    const resposta = await fetch(urlApi.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': ACCESS_TOKEN,
        'secret-access-token': SECRET_TOKEN,
      },
    });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      return res.status(resposta.status).json({
        code: resposta.status,
        status: 'error',
        data: erro || { mensagem: 'Erro desconhecido da API Betel' },
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

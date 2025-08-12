// arquivo: api/produtos.js (Vercel)

export default async function handler(req, res) {
  // Configura CORS para liberar requisições de qualquer origem
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,access-token,secret-access-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Tokens lidos das variáveis de ambiente configuradas no Vercel
  const ACCESS_TOKEN = process.env.ACCESS_TOKEN;
  const SECRET_TOKEN = process.env.SECRET_TOKEN;

  if (!ACCESS_TOKEN || !SECRET_TOKEN) {
    return res.status(500).json({
      code: 500,
      status: 'error',
      data: { mensagem: 'Tokens de acesso não configurados nas variáveis de ambiente.' }
    });
  }

  const { loja_id, pagina = "1", nome = "" } = req.query;

  const urlApi = new URL("https://api.beteltecnologia.com/produtos");
  urlApi.searchParams.append("pagina", pagina);
  if (loja_id) urlApi.searchParams.append("loja_id", loja_id);
  if (nome) urlApi.searchParams.append("nome", nome);

  try {
    const resposta = await fetch(urlApi.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "access-token": ACCESS_TOKEN,
        "secret-access-token": SECRET_TOKEN
      }
    });

    if (!resposta.ok) {
      const erro = await resposta.json().catch(() => ({}));
      return res.status(resposta.status).json({
        code: resposta.status,
        status: "error",
        data: erro || { mensagem: "Erro desconhecido da API Betel" }
      });
    }

    const dados = await resposta.json();
    return res.status(200).json(dados);

  } catch (error) {
    return res.status(500).json({
      code: 500,
      status: "error",
      data: { mensagem: "Erro interno no servidor: " + error.message }
    });
  }
}

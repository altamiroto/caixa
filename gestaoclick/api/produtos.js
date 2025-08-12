export default async function handler(req, res) {
  // Configura CORS para permitir requisições do seu frontend
  res.setHeader('Access-Control-Allow-Origin', '*'); // para todos os domínios; para maior segurança, especifique seu domínio
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, access-token, secret-access-token');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { pagina = 1, loja_id, nome } = req.query;

  const url = new URL('https://api.beteltecnologia.com/produtos');
  url.searchParams.append('pagina', pagina);
  if (loja_id) {
    url.searchParams.append('loja_id', loja_id);
  }
  if (nome) {
    url.searchParams.append('nome', nome); // só se a API suportar esse filtro
  }

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access-token': process.env.ACCESS_TOKEN,
        'secret-access-token': process.env.SECRET_TOKEN,
      },
    });

    if (!response.ok) {
      const erro = await response.json();
      return res.status(response.status).json(erro);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar produtos' });
  }
}

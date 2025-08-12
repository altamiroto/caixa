export default async function handler(req, res) {
  const { pagina = 1, loja_id } = req.query;

  const url = new URL("https://api.beteltecnologia.com/produtos");
  url.searchParams.append("pagina", pagina);
  if (loja_id) {
    url.searchParams.append("loja_id", loja_id);
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "access-token": process.env.ACCESS_TOKEN,
        "secret-access-token": process.env.SECRET_TOKEN,
      },
    });

    if (!response.ok) {
      const erro = await response.json();
      return res.status(response.status).json(erro);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
}

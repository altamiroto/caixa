export default async function handler(req, res) {
  try {
    const response = await fetch("https://api.beteltecnologia.com/produtos", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "access-token": "70b21a45cc992f08ece8f384072e0fba9b4bd034",
        "secret-access-token": "b833ae75916e14c6359c8da95dfbb0f8961a0479",
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

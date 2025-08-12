// arquivo: api/produtos.js
export default async function handler(req, res) {
  try {
    const response = await fetch("https://api.beteltecnologia.com/produtos", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "access-token": process.env.ACCESS_TOKEN,
        "secret-access-token": process.env.SECRET_TOKEN
      }
    });

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar produtos" });
  }
}

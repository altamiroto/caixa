export default async function handler(req, res) {
  // 1. Configuração de CORS (Essencial para integrações web)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  // 2. Verificação da API Key
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não encontrada no servidor.' });
  }

  try {
    const { messages, systemPrompt } = req.body;

    if (!messages || !systemPrompt) {
      return res.status(400).json({ error: 'Parâmetros "messages" e "systemPrompt" são obrigatórios.' });
    }

    // 3. Endpoint para a Versão 2.5 Flash
    // Note que usamos o ID exato: gemini-2.5-flash
    const MODEL = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // O Gemini 2.5 lida muito bem com instruções de sistema nativas
        system_instruction: {
          parts: [{ text: systemPrompt }]
        },
        contents: [
          {
            role: "user",
            parts: [{ text: messages }]
          }
        ],
        generationConfig: {
          temperature: 0.2, // Um pouco mais de criatividade, mas ainda controlado
          maxOutputTokens: 4096, // Limite maior aproveitando o poder do 2.5
        }
      })
    });

    const responseData = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "Erro na API Gemini 2.5",
        details: responseData
      });
    }

    // 4. Normalização do Retorno
    // Mantemos o padrão 'choices' para não quebrar seu front-end anterior
    const cleanText = responseData.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return res.status(200).json({
      choices: [
        {
          message: {
            role: "assistant",
            content: cleanText
          }
        }
      ],
      usage: responseData.usageMetadata // Útil para monitorar o consumo de tokens
    });

  } catch (error) {
    return res.status(500).json({ error: "Erro interno", message: error.message });
  }
}

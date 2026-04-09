export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  // 1. Agora permitimos conexões GET (para buscar a lista de modelos)
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não encontrada no servidor.' });
  }

  // 2. NOVA RESPOSTA: Se a tela pedir a lista de modelos, ele usa seu token interno pra devolver
  if (req.method === 'GET') {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      const data = await response.json();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: "Erro ao buscar modelos" });
    }
  }
  
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  
  try {
    // 3. AGORA NÓS RECEBEMOS O MODELO QUE A TELA ESCOLHER! (req.body.model)
    const { messages, systemPrompt, model } = req.body;
    if (!messages || !systemPrompt) {
      return res.status(400).json({ error: 'Parâmetros "messages" e "systemPrompt" são obrigatórios.' });
    }
    
    // Se a tela não enviar nada, ele usa o 2.5 Flash, senão, usa o modelo que a tela mandou!
    const MODEL = model || "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [ { role: "user", parts: [{ text: messages }] } ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 65536, // ← Seu MÁXIMO GRATUITO original preservado
          topP: 0.95,
          topK: 40
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });
    
    const responseData = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json({
        error: "Erro na API Gemini",
        details: responseData
      });
    }
    
    const candidate = responseData.candidates?.[0];
    const cleanText = candidate?.content?.parts?.[0]?.text || "";
    
    return res.status(200).json({
      choices: [{
        message: { role: "assistant", content: cleanText },
        finishReason: candidate?.finishReason,
        tokensUsed: {
          input: responseData.usageMetadata?.promptTokenCount,
          output: responseData.usageMetadata?.candidatesTokenCount,
          total: responseData.usageMetadata?.totalTokenCount
        }
      }],
      usage: responseData.usageMetadata
    });
    
  } catch (error) {
    console.error('❌ Erro na API:', error);
    return res.status(500).json({ error: "Erro interno", message: error.message });
  }
}

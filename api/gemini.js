export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });
  
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY não encontrada no servidor.' });
  }
  
  try {
    const { messages, systemPrompt } = req.body;
    if (!messages || !systemPrompt) {
      return res.status(400).json({ error: 'Parâmetros "messages" e "systemPrompt" são obrigatórios.' });
    }
    
    const MODEL = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
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
          temperature: 0.4,
          maxOutputTokens: 8192, // MÁXIMO GRATUITO
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
        error: "Erro na API Gemini 2.5",
        details: responseData
      });
    }
    
    const candidate = responseData.candidates?.[0];
    const cleanText = candidate?.content?.parts?.[0]?.text || "";
    
    // Log para monitoramento
    console.log('Finish Reason:', candidate?.finishReason);
    console.log('Tokens Input:', responseData.usageMetadata?.promptTokenCount);
    console.log('Tokens Output:', responseData.usageMetadata?.candidatesTokenCount);
    console.log('Total Tokens:', responseData.usageMetadata?.totalTokenCount);
    
    // Avisar se truncou
    if (candidate?.finishReason === 'MAX_TOKENS') {
      console.warn('⚠️ ATENÇÃO: Resposta truncada! Lista muito grande para processar de uma vez.');
    }
    
    return res.status(200).json({
      choices: [
        {
          message: {
            role: "assistant",
            content: cleanText
          },
          finishReason: candidate?.finishReason,
          tokensUsed: {
            input: responseData.usageMetadata?.promptTokenCount,
            output: responseData.usageMetadata?.candidatesTokenCount,
            total: responseData.usageMetadata?.totalTokenCount
          }
        }
      ],
      usage: responseData.usageMetadata
    });
    
  } catch (error) {
    return res.status(500).json({ error: "Erro interno", message: error.message });
  }
}

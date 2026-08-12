export default async function handler(req, res) {
  // Configura CORS (se necessário)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responde ao preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Só aceita requisições POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  // Valida se a API key está configurada
  if (!process.env.DEEPSEEK) {
    console.error('DEEPSEEK (API key) não configurada');
    return res.status(500).json({ error: 'API key não configurada no servidor' });
  }

  try {
    const { messages, systemPrompt } = req.body;

    // Valida os dados recebidos
    if (!messages || !systemPrompt) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    console.log('Fazendo requisição à API DeepSeek...');

    // Endpoint mantido em /api/groq de propósito (o front-end já aponta pra
    // cá) — só o provedor por trás mudou de Groq para DeepSeek.
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.DEEPSEEK}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        // V4 Flash vem com "thinking" ligado por padrão (esforço alto);
        // desligamos explicitamente pra resposta rápida, sem raciocínio
        // profundo — é só limpeza/extração de texto, não precisa disso.
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messages }
        ],
        temperature: 0.1
      })
    });

    // Pega o texto da resposta primeiro
    const responseText = await response.text();
    console.log('Status da resposta:', response.status);
    console.log('Resposta recebida (primeiros 200 chars):', responseText.substring(0, 200));

    // Tenta fazer o parse do JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Erro ao fazer parse do JSON:', parseError);
      console.error('Resposta completa:', responseText);
      return res.status(500).json({
        error: 'Resposta inválida da API DeepSeek',
        details: responseText.substring(0, 500)
      });
    }

    // Verifica se houve erro na API
    if (!response.ok) {
      console.error('Erro da API DeepSeek:', data);
      return res.status(response.status).json({
        error: data.error?.message || 'Erro na API DeepSeek',
        details: data
      });
    }

    // Retorna a resposta bem-sucedida
    console.log('Resposta processada com sucesso');
    return res.status(200).json(data);

  } catch (error) {
    console.error('Erro no handler:', error);
    return res.status(500).json({ 
      error: 'Erro interno do servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

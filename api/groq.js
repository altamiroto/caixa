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

  try {
    const { messages, systemPrompt, provider } = req.body;

    // Valida os dados recebidos
    if (!messages || !systemPrompt) {
      return res.status(400).json({ error: 'Parâmetros inválidos' });
    }

    // Padrão: Groq. DeepSeek só quando o front-end pedir explicitamente
    // (seletor "Provedor de IA" na Busca em Lote, usado pra testar).
    const prov = provider === 'deepseek' ? 'deepseek' : 'groq';

    let apiUrl, apiKey, corpo;
    if (prov === 'deepseek') {
      apiKey = process.env.DEEPSEEK;
      if (!apiKey) {
        console.error('DEEPSEEK (API key) não configurada');
        return res.status(500).json({ error: 'API key da DeepSeek não configurada no servidor' });
      }
      apiUrl = "https://api.deepseek.com/chat/completions";
      corpo = {
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
      };
    } else {
      apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        console.error('GROQ_API_KEY não configurada');
        return res.status(500).json({ error: 'API key da Groq não configurada no servidor' });
      }
      apiUrl = "https://api.groq.com/openai/v1/chat/completions";
      corpo = {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messages }
        ],
        temperature: 0.1
      };
    }

    console.log('Fazendo requisição à API ' + prov + '...');

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(corpo)
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
        error: 'Resposta inválida da API ' + prov,
        details: responseText.substring(0, 500)
      });
    }

    // Verifica se houve erro na API
    if (!response.ok) {
      console.error('Erro da API ' + prov + ':', data);
      return res.status(response.status).json({
        error: data.error?.message || ('Erro na API ' + prov),
        details: data
      });
    }

    // Retorna a resposta bem-sucedida
    console.log('Resposta processada com sucesso (' + prov + ')');
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

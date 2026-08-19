// Faz a chamada HTTP e devolve { ok, status, data } já com o corpo parseado,
// sem lançar exceção em erro de API (só em erro de rede/fetch).
async function chamarModelo(apiUrl, apiKey, corpo) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(corpo)
  });

  const responseText = await response.text();
  console.log('Status da resposta:', response.status);
  console.log('Resposta recebida (primeiros 200 chars):', responseText.substring(0, 200));

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (parseError) {
    console.error('Erro ao fazer parse do JSON:', parseError);
    console.error('Resposta completa:', responseText);
    return {
      ok: false,
      status: 500,
      data: { error: 'Resposta inválida da API', details: responseText.substring(0, 500) }
    };
  }

  return { ok: response.ok, status: response.status, data };
}

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

    if (prov === 'deepseek') {
      const apiKey = process.env.DEEPSEEK;
      if (!apiKey) {
        console.error('DEEPSEEK (API key) não configurada');
        return res.status(500).json({ error: 'API key da DeepSeek não configurada no servidor' });
      }
      const corpo = {
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

      console.log('Fazendo requisição à API deepseek...');
      const result = await chamarModelo("https://api.deepseek.com/chat/completions", apiKey, corpo);
      if (!result.ok) {
        console.error('Erro da API deepseek:', result.data);
        return res.status(result.status).json({
          error: result.data?.error?.message || result.data?.error || 'Erro na API deepseek',
          details: result.data
        });
      }
      console.log('Resposta processada com sucesso (deepseek)');
      return res.status(200).json(result.data);
    }

    // Groq: tenta uma cadeia de modelos, em ordem, passando para o próximo
    // quando um deles esgota a cota (429) ou não está mais disponível
    // (ex: llama-3.3-70b-versatile foi descontinuado pela Groq). Só desiste
    // na cadeia toda, ou num erro que não é de quota/disponibilidade
    // (ex: prompt inválido), caso em que propaga o erro imediatamente.
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      console.error('GROQ_API_KEY não configurada');
      return res.status(500).json({ error: 'API key da Groq não configurada no servidor' });
    }
    const apiUrl = "https://api.groq.com/openai/v1/chat/completions";
    // groq/compound e groq/compound-mini ficam de fora: são sistemas
    // agentic (podem chamar ferramentas, navegar, etc.) e às vezes devolvem
    // content vazio pra uma tarefa que só precisa de "responda só com JSON"
    // — quebra o JSON.parse do front-end com "Unexpected end of JSON input".
    const GROQ_MODELS = [
      "openai/gpt-oss-120b",
      "qwen/qwen3.6-27b",
      "openai/gpt-oss-20b",
      "allam-2-7b"
    ];

    // Todo uso atual desse endpoint pede JSON no systemPrompt ("retorne
    // apenas JSON válido"). Quando é o caso, validamos se o content
    // realmente é JSON parseável antes de aceitar a resposta — protege
    // contra truncamento (resposta cortada no meio, sem fechar colchete)
    // que passaria como "sucesso" e só quebraria o parse no front-end.
    const esperaJson = /json/i.test(systemPrompt);

    // Extrai e valida o JSON de dentro do texto, tolerando cerca (```json)
    // e frases antes/depois que o modelo às vezes cola mesmo mandado não
    // fazer isso (ex: "Aqui está o resultado:" antes do array).
    function extrairJson(texto) {
      let limpo = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
      try { return { ok: true, valor: JSON.parse(limpo) }; } catch (e) { /* tenta isolar abaixo */ }

      const iniA = limpo.indexOf('['), iniO = limpo.indexOf('{');
      const inicio = (iniA === -1) ? iniO : (iniO === -1 ? iniA : Math.min(iniA, iniO));
      if (inicio === -1) return { ok: false };
      const abre = limpo[inicio], fecha = abre === '[' ? ']' : '}';
      const fim = limpo.lastIndexOf(fecha);
      if (fim === -1 || fim <= inicio) return { ok: false };
      const fatia = limpo.slice(inicio, fim + 1);
      try { return { ok: true, valor: JSON.parse(fatia) }; } catch (e) { return { ok: false }; }
    }

    let lastResult = null;
    for (const model of GROQ_MODELS) {
      const corpo = {
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: messages }
        ],
        temperature: 0.1
      };
      // Modelos de raciocínio gastam parte do orçamento de tokens
      // "pensando" (campo reasoning) antes de preencher o content final.
      // A causa raiz do content vazio era o orçamento de tokens acabar
      // no meio do caminho — por isso max_completion_tokens generoso
      // abaixo. reasoning_effort baixo/desligado é só um reforço, não a
      // correção principal (listas maiores precisam de algum raciocínio
      // pra não sair com JSON malformado).
      if (model === "qwen/qwen3.6-27b") {
        corpo.reasoning_effort = "none"; // família qwen3 aceita desligar de vez
        corpo.max_completion_tokens = 8000;
      } else if (model.startsWith("openai/gpt-oss")) {
        corpo.reasoning_effort = "low"; // gpt-oss não aceita "none" (erro 400); low é o mínimo
        corpo.max_completion_tokens = 8000;
      }
      // allam-2-7b não tem reasoning_effort nem confirmação de contexto
      // grande — deixa sem max_completion_tokens explícito pra não
      // arriscar um 400 de "valor inválido" nesse modelo pequeno.

      console.log(`Fazendo requisição à API groq (modelo: ${model})...`);
      const result = await chamarModelo(apiUrl, apiKey, corpo);

      if (result.ok) {
        const conteudo = result.data?.choices?.[0]?.message?.content;
        if (conteudo && conteudo.trim()) {
          if (!esperaJson) {
            console.log(`Resposta processada com sucesso (groq, modelo: ${model})`);
            return res.status(200).json(result.data);
          }
          const extraido = extrairJson(conteudo);
          if (extraido.ok) {
            console.log(`Resposta processada com sucesso (groq, modelo: ${model})`);
            // Devolve só o JSON limpo (sem cerca ```/texto ao redor) —
            // o front-end faz um JSON.parse estrito, sem essa tolerância.
            result.data.choices[0].message.content = JSON.stringify(extraido.valor);
            return res.status(200).json(result.data);
          }
          console.error(`Modelo ${model} respondeu, mas não é JSON válido (provável truncamento), tentando o próximo`);
          lastResult = { status: 502, data: { error: `Modelo ${model} não devolveu JSON válido`, details: conteudo.slice(0, 500) } };
          continue;
        }
        // HTTP 200 mas sem conteúdo de fato (ex: reasoning consumiu todos
        // os tokens) — não adianta devolver pro front-end, tenta o próximo.
        console.error(`Modelo ${model} respondeu vazio, tentando o próximo`);
        lastResult = { status: 502, data: { error: `Modelo ${model} retornou resposta vazia` } };
        continue;
      }

      // Sempre tenta o próximo modelo da cadeia, seja qual for o erro
      // (429 esgotado, 404/model_not_found descontinuado, 413 payload,
      // 400 contexto excedido nesse modelo específico, 500 instabilidade
      // etc.) — um erro de um modelo não significa que os outros vão
      // falhar igual, e o ponto inteiro dessa cadeia é resiliência. Só
      // desiste de fato depois de esgotar todos os modelos da lista.
      console.error(`Erro no modelo ${model} (HTTP ${result.status}), tentando o próximo:`, result.data);
      lastResult = result;
    }

    return res.status(lastResult?.status || 500).json({
      error: lastResult?.data?.error?.message || lastResult?.data?.error || 'Erro na API groq',
      details: lastResult?.data
    });

  } catch (error) {
    console.error('Erro no handler:', error);
    return res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

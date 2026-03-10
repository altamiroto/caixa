import { BUTTONS } from "../config.mjs";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "troque-este-segredo-em-producao");

const logs = [];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization?.replace("Bearer ", "");
  if (!auth) return res.status(401).json({ error: "Não autenticado" });

  let payload;
  try {
    const result = await jwtVerify(auth, SECRET);
    payload = result.payload;
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada" });
  }

  const { buttonId } = req.body || {};
  const button = BUTTONS.find(b => b.id === buttonId);

  if (!button) return res.status(404).json({ error: "Botão não encontrado" });

  try {
    const webhookRes = await fetch(button.webhook, { method: "GET" });
    const success = webhookRes.ok;

    const entry = {
      id: Date.now(),
      user: payload.name,
      username: payload.username,
      button: button.label,
      buttonId: button.id,
      success,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(entry);
    if (logs.length > 200) logs.pop();

    if (success) {
      return res.status(200).json({ ok: true, message: `${button.label} acionado com sucesso!` });
    } else {
      return res.status(502).json({ error: "Webhook retornou erro" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Falha ao chamar o webhook" });
  }
}

export { logs };

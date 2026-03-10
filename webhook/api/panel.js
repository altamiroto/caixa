import { BUTTONS, APP_TITLE, APP_SUBTITLE } from "../config.js";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "troque-este-segredo-em-producao");

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization?.replace("Bearer ", "");
  if (!auth) return res.status(401).json({ error: "Não autenticado" });

  try {
    const { payload } = await jwtVerify(auth, SECRET);

    // Retorna botões SEM o webhook (segurança)
    const safeButtons = BUTTONS.map(({ id, label, icon, description, color, confirmMessage }) => ({
      id, label, icon, description, color, confirmMessage,
    }));

    res.status(200).json({
      user: { name: payload.name, username: payload.username },
      buttons: safeButtons,
      appTitle: APP_TITLE,
      appSubtitle: APP_SUBTITLE,
    });
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada" });
  }
}

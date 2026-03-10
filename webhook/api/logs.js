import { logs } from "./trigger.js";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "troque-este-segredo-em-producao");

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const auth = req.headers.authorization?.replace("Bearer ", "");
  if (!auth) return res.status(401).json({ error: "Não autenticado" });

  try {
    await jwtVerify(auth, SECRET);
    res.status(200).json({ logs: logs.slice(0, 50) });
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada" });
  }
}

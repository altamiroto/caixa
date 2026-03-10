# 🔐 Painel de Controle de Webhooks

Painel seguro com login por usuário, botões configuráveis e log de acionamentos.

---

## 📁 Estrutura

```
webhook-panel/
├── config.js          ← EDITE AQUI: usuários e botões
├── vercel.json        ← Configuração do Vercel
├── package.json
├── api/
│   ├── login.js       ← Autenticação
│   ├── panel.js       ← Lista botões (sem expor webhooks)
│   ├── trigger.js     ← Aciona o webhook
│   └── logs.js        ← Retorna histórico
└── public/
    └── index.html     ← Interface
```

---

## ⚙️ Configuração (config.js)

### Usuários
```js
export const USERS = [
  { username: "joao", password: "senha123", name: "João Silva" },
  // adicione quantos quiser
];
```

### Botões
```js
export const BUTTONS = [
  {
    id: "portao",               // identificador único
    label: "Portão",            // nome exibido
    icon: "🚪",                 // emoji
    description: "Abre o portão", // descrição abaixo
    color: "blue",              // blue | yellow | red | green | purple
    webhook: "https://...",     // URL real (fica no servidor, invisível)
    confirmMessage: "Confirmar?", // texto do modal
  },
];
```

---

## 🚀 Deploy no Vercel (grátis)

### Opção A — Via GitHub (recomendado)

1. Crie uma conta em https://vercel.com
2. Crie um repositório no GitHub e envie esta pasta
3. No Vercel: **Add New Project** → importe o repositório
4. Adicione a variável de ambiente:
   - Nome: `JWT_SECRET`
   - Valor: qualquer string aleatória longa (ex: `meu-segredo-super-secreto-2024`)
5. Clique em **Deploy** ✅

### Opção B — Via CLI

```bash
npm install -g vercel
cd webhook-panel
vercel
# Responda as perguntas, depois:
vercel env add JWT_SECRET
# Digite seu segredo e pressione Enter
vercel --prod
```

---

## 🔒 Segurança

- ✅ Os webhooks **nunca aparecem** no frontend (ficam só no servidor)
- ✅ Sessão expira automaticamente (padrão: 8 horas)
- ✅ Cada acionamento registra usuário, botão e horário
- ✅ Modal de confirmação evita toques acidentais
- ⚠️ O log é em memória — reiniciar o servidor limpa o histórico
  → Para log permanente, conecte um banco como Vercel KV ou Supabase

---

## 📝 Personalização

Em `config.js`:
- `APP_TITLE` — título do painel
- `APP_SUBTITLE` — subtítulo na tela de login
- `SESSION_HOURS` — duração da sessão em horas

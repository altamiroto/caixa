// ============================================================
//  CONFIGURAÇÃO DO PAINEL - EDITE AQUI
// ============================================================

export const USERS = [
  { username: "admin",   password: "senha123",  name: "Administrador" },
  { username: "joao",    password: "joao456",   name: "João Silva"     },
  { username: "maria",   password: "maria789",  name: "Maria Souza"    },
  // Adicione mais usuários aqui:
  // { username: "nome", password: "senha", name: "Nome Completo" },
];

export const BUTTONS = [
  {
    id: "portao",
    label: "Portão",
    icon: "🚪",
    description: "Abre/fecha o portão principal",
    color: "blue",
    webhook: "https://sequematic.com/trigger-ifttt-webhook/63E4F16318/161994/Portao",
    confirmMessage: "Deseja acionar o Portão?",
  },
  // Adicione mais botões aqui:
  // {
  //   id: "id_unico",
  //   label: "Nome do Botão",
  //   icon: "🏠",
  //   description: "Descrição do que faz",
  //   color: "green",  // blue | yellow | red | green | purple
  //   webhook: "https://seu-webhook.com/comando",
  //   confirmMessage: "Tem certeza que deseja acionar X?",
  // },
];

export const APP_TITLE = "Painel de Controle";
export const APP_SUBTITLE = "Acesso autorizado";

// Tempo de sessão em horas
export const SESSION_HOURS = 168; // 7 dias

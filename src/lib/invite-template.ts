/**
 * Invite email template: shared, pure rendering used by both the admin preview
 * and the server-side invite flow, so what the admin sees is what is sent.
 */
export type InviteTemplate = {
  lang: "ru" | "en";
  subject: string;
  heading: string;
  body: string;
  button_label: string;
  footer: string;
};

export type InviteVars = {
  full_name: string;
  email: string;
  link: string;
  brand: string;
};

export const INVITE_PLACEHOLDERS = ["full_name", "email", "link", "brand"] as const;

export const DEFAULT_INVITE_TEMPLATES: Record<"ru" | "en", InviteTemplate> = {
  ru: {
    lang: "ru",
    subject: "Новый адрес кабинета собственника — clients.theumalas.com",
    heading: "{{full_name}}, кабинет переехал на новый адрес",
    body: [
      "Личный кабинет собственника The Umalas Signature теперь открывается по адресу https://clients.theumalas.com",
      "",
      "Как войти — пошагово:",
      "1. Нажмите кнопку ниже (ссылка персональная, только для {{email}}).",
      "2. Задайте пароль — минимум 8 символов — и подтвердите его.",
      "3. Вы попадёте в кабинет: документы по объекту, отчёты ROI / IPL, квитанции и календарь выплат.",
      "4. В следующий раз откройте https://clients.theumalas.com, введите {{email}} и пароль и нажмите «Войти с паролем» (не «Создать аккаунт»).",
      "5. Вопросы — кнопка WhatsApp внизу кабинета, отвечаем лично.",
      "",
      "— — —",
      "",
      "Your owner cabinet is now at https://clients.theumalas.com",
      "",
      "How to sign in — step by step:",
      "1. Click the button below (a personal link for {{email}}).",
      "2. Set a password — at least 8 characters — and confirm it.",
      "3. You will land in your cabinet: unit documents, ROI / IPL reports, receipts and the payout calendar.",
      "4. Next time open https://clients.theumalas.com, enter {{email}} and your password and press “Sign in with password” (not “Create account”).",
      "5. Any questions — use the WhatsApp button at the bottom of the cabinet.",
    ].join("\n"),
    button_label: "Задать пароль и войти / Set password",
    footer:
      "Ссылка действует ограниченное время. Если она не работает — ответьте на это письмо, отправим новую. · This link expires after a while; reply to this email for a new one. Managed by LUXSO.",
  },
  en: {
    lang: "en",
    subject: "Your owner cabinet has a new address — clients.theumalas.com",
    heading: "{{full_name}}, your cabinet moved to a new address",
    body: [
      "Your The Umalas Signature owner cabinet is now at https://clients.theumalas.com",
      "",
      "How to sign in — step by step:",
      "1. Click the button below (a personal link for {{email}}).",
      "2. Set a password — at least 8 characters — and confirm it.",
      "3. You will land in your cabinet: unit documents, ROI / IPL reports, receipts and the payout calendar.",
      "4. Next time open https://clients.theumalas.com, enter {{email}} and your password and press “Sign in with password” (not “Create account”).",
      "5. Any questions — use the WhatsApp button at the bottom of the cabinet.",
      "",
      "— — —",
      "",
      "Личный кабинет собственника теперь открывается по адресу https://clients.theumalas.com",
      "",
      "Как войти — пошагово:",
      "1. Нажмите кнопку ниже (ссылка персональная, только для {{email}}).",
      "2. Задайте пароль — минимум 8 символов — и подтвердите его.",
      "3. Вы попадёте в кабинет: документы, отчёты ROI / IPL, квитанции и календарь выплат.",
      "4. В следующий раз откройте https://clients.theumalas.com и нажмите «Войти с паролем».",
      "5. Вопросы — кнопка WhatsApp внизу кабинета.",
    ].join("\n"),
    button_label: "Set password / Задать пароль",
    footer:
      "This link expires after a while; reply to this email and we will send a new one. · Ссылка действует ограниченное время — ответьте на письмо, отправим новую. Managed by LUXSO.",
  },
};


/** Replaces {{placeholder}} tokens; unknown tokens are left untouched. */
export function renderInviteText(text: string, vars: InviteVars): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key in vars ? String(vars[key as keyof InviteVars]) : match,
  );
}

export function renderInviteTemplate(template: InviteTemplate, vars: InviteVars) {
  return {
    subject: renderInviteText(template.subject, vars),
    heading: renderInviteText(template.heading, vars),
    body: renderInviteText(template.body, vars),
    button_label: renderInviteText(template.button_label, vars),
    footer: renderInviteText(template.footer, vars),
  };
}

export const SAMPLE_INVITE_VARS: InviteVars = {
  full_name: "Yessen Musrepov",
  email: "owner@example.com",
  link: "https://umalas-owner-haven.lovable.app/",
  brand: "The Umalas Signature",
};

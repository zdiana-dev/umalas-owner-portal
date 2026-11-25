CREATE TABLE IF NOT EXISTS public.email_templates (
  lang text PRIMARY KEY CHECK (lang IN ('ru', 'en')),
  subject text NOT NULL DEFAULT '',
  heading text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  button_label text NOT NULL DEFAULT '',
  footer text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_templates_admin_all ON public.email_templates;
CREATE POLICY email_templates_admin_all ON public.email_templates
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.email_templates (lang, subject, heading, body, button_label, footer)
VALUES
  ('ru',
   'Приглашение в кабинет собственника — The Umalas Signature',
   'Добро пожаловать, {{full_name}}',
   E'Для вас открыт личный кабинет собственника The Umalas Signature.\n\nВ кабинете доступны документы по вашему объекту и отчёты ROI / IPL. Чтобы войти, задайте пароль по ссылке ниже.',
   'Задать пароль и войти',
   'Ссылка действует ограниченное время. Если она не работает, ответьте на это письмо — мы отправим новую. Managed by LUXSO.'),
  ('en',
   'Your owner cabinet invitation — The Umalas Signature',
   'Welcome, {{full_name}}',
   E'Your private owner cabinet at The Umalas Signature is ready.\n\nInside you will find the documents for your unit and your ROI / IPL reports. Set a password using the link below to sign in.',
   'Set password and sign in',
   'This link is valid for a limited time. If it has expired, reply to this email and we will send a new one. Managed by LUXSO.')
ON CONFLICT (lang) DO NOTHING;
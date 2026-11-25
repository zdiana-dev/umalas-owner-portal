import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { sendMessage, type MessageRow } from "@/lib/messages";

type Props = {
  messages: MessageRow[];
  ownerId: string;
  /** True when the current user is the administrator replying in the thread. */
  asAdmin: boolean;
  lang: "ru" | "en";
  unitId?: string | null;
  onSent: () => void;
  placeholder?: string;
};

const copy = {
  ru: {
    empty: "Пока нет сообщений. Напишите первое — мы ответим здесь же.",
    greeting:
      "Добро пожаловать в личный кабинет собственника The Umalas Signature.\n\nЗдесь вы можете задавать вопросы управляющей компании, получать отчёты и следить за выплатами по вашему объекту. Напишите нам — мы ответим в ближайшее время. Также вы можете связаться с нами через WhatsApp.",
    greetingSender: "Управляющая компания",
    send: "Отправить",
    sending: "Отправляем…",
    you: "Вы",
    admin: "Управляющая компания",
    owner: "Собственник",
    error: "Не удалось отправить сообщение. Попробуйте ещё раз.",
    ph: "Ваш вопрос управляющей компании…",
    phAdmin: "Ответ собственнику…",
  },
  en: {
    empty: "No messages yet. Write the first one — replies appear right here.",
    greeting:
      "Welcome to The Umalas Signature owner portal.\n\nHere you can ask the management team questions, access reports and track payouts for your unit. Send us a message — we will reply shortly. You can also reach us via WhatsApp.",
    greetingSender: "Management team",
    send: "Send",
    sending: "Sending…",
    you: "You",
    admin: "Management",
    owner: "Owner",
    error: "Could not send the message. Please try again.",
    ph: "Your question to the management team…",
    phAdmin: "Reply to the owner…",
  },
} as const;

function stamp(iso: string, lang: "ru" | "en") {
  return new Date(iso).toLocaleString(lang === "ru" ? "ru-RU" : "en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageThread({
  messages,
  ownerId,
  asAdmin,
  lang,
  unitId,
  onSent,
  placeholder,
}: Props) {
  const c = copy[lang];
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function submit() {
    const text = body.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      await sendMessage({ ownerId, body: text, fromAdmin: asAdmin, unitId });
      setBody("");
      onSent();
    } catch {
      setError(c.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl border border-border bg-card px-4 py-3 text-sm">
              <p className="eyebrow mb-1 text-[10px]">{c.greetingSender}</p>
              <p className="whitespace-pre-wrap leading-relaxed">{c.greeting}</p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const mine = asAdmin ? m.from_admin : !m.from_admin;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                    mine
                      ? "bg-violet/12 border border-violet/25"
                      : "border border-border bg-card",
                  )}
                >
                  <p className="eyebrow mb-1 text-[10px]">
                    {mine ? c.you : m.from_admin ? c.admin : c.owner} · {stamp(m.created_at, lang)}
                  </p>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder={placeholder ?? (asAdmin ? c.phAdmin : c.ph)}
          className="w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none transition-colors focus-visible:border-violet focus-visible:ring-2 focus-visible:ring-violet/30"
        />
        {error ? <p className="text-sm text-rose">{error}</p> : null}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || body.trim().length === 0}
          className="rounded-full border border-violet/40 px-5 py-2 text-[11px] uppercase tracking-[0.14em] transition-colors hover:bg-violet/10 disabled:opacity-40"
        >
          {busy ? c.sending : c.send}
        </button>
      </div>
    </div>
  );
}

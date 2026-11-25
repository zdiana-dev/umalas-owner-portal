import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

import { BrandButton } from "@/components/portal/BrandButton";
import { EmptyState } from "@/components/portal/EmptyState";
import {
  askMyDocuments,
  clearChatHistory,
  getChatHistory,
  type ChatTurn,
} from "@/lib/assistant.functions";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistant")({
  head: () => ({
    meta: [
      { title: "Assistant — Owner Portal | The Umalas Signature" },
      {
        name: "description",
        content:
          "Chat with the assistant about your documents, ROI reports, payouts and project rules inside The Umalas Signature owner cabinet.",
      },
      { property: "og:title", content: "Assistant — Owner Portal | The Umalas Signature" },
      {
        property: "og:description",
        content: "Answers built from your own villa documents, payout reports and project rules.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssistantPage,
});

function AssistantPage() {
  const { t, lang } = useI18n();
  const ask = useServerFn(askMyDocuments);
  const loadHistory = useServerFn(getChatHistory);
  const clearHistory = useServerFn(clearChatHistory);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noUnits, setNoUnits] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadHistory()
      .then((result) => {
        if (!cancelled) setTurns(result.turns);
      })
      .catch(() => {
        // A history failure must not block the chat.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  useEffect(() => {
    if (loaded) inputRef.current?.focus();
  }, [loaded]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns, busy]);

  const samples = [t("assistant.sample1"), t("assistant.sample2"), t("assistant.sample3")];

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || busy) return;
    setError(null);
    setQuestion("");
    setTurns((prev) => [...prev, { role: "user", text: clean }]);
    setBusy(true);
    try {
      const result = await ask({ data: { question: clean, lang } });
      if (result.empty) {
        setNoUnits(true);
      } else {
        setTurns((prev) => [
          ...prev,
          {
            role: "assistant",
            text: result.answer || t("assistant.blank"),
            sources: result.sources,
          },
        ]);
      }
    } catch {
      setError(t("assistant.error"));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function startNew() {
    if (busy || !window.confirm(t("assistant.newChatConfirm"))) return;
    setBusy(true);
    try {
      await clearHistory();
      setTurns([]);
      setError(null);
    } catch {
      setError(t("assistant.error"));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  if (noUnits) {
    return <EmptyState title={t("assistant.title")} hint={t("assistant.noUnits")} />;
  }

  return (
    <div className="anim-rise space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-display text-2xl">{t("assistant.title")}</h1>
          {turns.length > 0 ? (
            <button
              type="button"
              onClick={() => void startNew()}
              className="rounded-full border border-border px-3.5 py-1.5 text-xs tracking-[0.12em] uppercase transition-colors hover:border-primary/60 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
            >
              {t("assistant.newChat")}
            </button>
          ) : null}
        </div>
        <div className="brand-rule mt-4 h-[2px] w-full" />
        <p className="mt-4 text-sm leading-6 text-muted-foreground">{t("assistant.intro")}</p>
      </div>

      {!loaded ? (
        <p className="animate-pulse text-sm text-muted-foreground">{t("assistant.loading")}</p>
      ) : null}

      {loaded && turns.length === 0 ? (
        <div className="space-y-3">
          <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            {t("assistant.samplesTitle")}
          </p>
          <div className="flex flex-wrap gap-2">
            {samples.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => void send(sample)}
                className="rounded-full border border-border px-3.5 py-2 text-left text-sm transition-colors hover:border-primary/60 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
              >
                {sample}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="space-y-6">
        {turns.map((turn, index) => (
          <div
            key={index}
            className={cn("flex", turn.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[92%] sm:max-w-[80%]",
                turn.role === "user"
                  ? "bg-primary text-primary-foreground rounded-2xl px-4 py-3 text-sm leading-6"
                  : "text-sm leading-6 text-foreground",
              )}
            >
              {turn.role === "assistant" ? (
                <div className="prose prose-sm max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                  <ReactMarkdown>{turn.text}</ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{turn.text}</p>
              )}
              {turn.sources && turn.sources.length > 0 ? (
                <div className="mt-3 border-t border-border/70 pt-2">
                  <p className="text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
                    {t("assistant.sources")}
                  </p>
                  <ul className="mt-1.5 space-y-1 text-xs text-muted-foreground">
                    {turn.sources.map((source) => (
                      <li key={`${source.kind}-${source.id}`}>{source.title}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ))}
        {busy ? (
          <p className="animate-pulse text-sm text-muted-foreground">{t("assistant.thinking")}</p>
        ) : null}
        <div ref={endRef} />
      </div>

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(question);
        }}
      >
        <textarea
          ref={inputRef}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send(question);
            }
          }}
          rows={3}
          placeholder={t("assistant.placeholder")}
          className="w-full resize-none rounded-2xl border border-border bg-card px-4 py-3 text-sm leading-6 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
        />
        <div className="sm:max-w-[240px]">
          <BrandButton type="submit" busy={busy} disabled={question.trim().length < 2}>
            {t("assistant.send")}
          </BrandButton>
        </div>
        <p className="text-xs text-muted-foreground">{t("assistant.disclaimer")}</p>
      </form>
    </div>
  );
}

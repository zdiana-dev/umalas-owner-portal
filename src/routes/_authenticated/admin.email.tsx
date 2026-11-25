import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { useI18n } from "@/lib/i18n";
import { getInviteTemplates, saveInviteTemplate } from "@/lib/admin.functions";
import {
  DEFAULT_INVITE_TEMPLATES,
  INVITE_PLACEHOLDERS,
  SAMPLE_INVITE_VARS,
  renderInviteTemplate,
  type InviteTemplate,
} from "@/lib/invite-template";
import { SectionTitle } from "@/components/portal/Figures";

export const Route = createFileRoute("/_authenticated/admin/email")({
  head: () => ({
    meta: [
      { title: "Invitation email — The Umalas Signature" },
      {
        name: "description",
        content: "Edit the subject and wording of the owner invitation email and preview it.",
      },
      { property: "og:title", content: "Invitation email — The Umalas Signature" },
      { property: "og:description", content: "Invitation email template and preview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EmailTemplatePage,
});

const field =
  "mt-2 w-full border-b border-input bg-transparent pb-2 text-sm outline-none focus:border-violet";
const button =
  "border border-violet bg-violet px-4 py-2 text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-violet-deep disabled:opacity-50";
const ghost =
  "text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-foreground";

function EmailTemplatePage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const listFn = useServerFn(getInviteTemplates);
  const saveFn = useServerFn(saveInviteTemplate);

  const templates = useQuery({
    queryKey: ["admin", "invite-templates"],
    queryFn: () => listFn({}),
  });

  const [lang, setLang] = useState<"ru" | "en">("ru");
  const [draft, setDraft] = useState<InviteTemplate>(DEFAULT_INVITE_TEMPLATES.ru);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const loaded = templates.data?.[lang];
    if (loaded) setDraft({ ...loaded, lang });
  }, [templates.data, lang]);

  const preview = renderInviteTemplate(draft, SAMPLE_INVITE_VARS);

  async function save() {
    setBusy(true);
    try {
      await saveFn({
        data: {
          lang,
          subject: draft.subject.trim(),
          heading: draft.heading.trim(),
          body: draft.body.trim(),
          button_label: draft.button_label.trim(),
          footer: draft.footer.trim(),
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["admin", "invite-templates"] });
      toast.success(t("admin.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <SectionTitle>{t("admin.emailTemplate")}</SectionTitle>
        <p className="border-l-2 border-violet bg-cream px-4 py-3 text-xs text-muted-foreground">
          {t("admin.emailTemplateNote")}
        </p>
        <div className="flex gap-4">
          {(["ru", "en"] as const).map((code) => (
            <button
              key={code}
              type="button"
              className={
                code === lang
                  ? "text-[11px] tracking-[0.12em] text-foreground uppercase"
                  : ghost
              }
              onClick={() => setLang(code)}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("admin.emailVars")}{" "}
          {INVITE_PLACEHOLDERS.map((name) => `{{${name}}}`).join("  ·  ")}
        </p>
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section className="space-y-6">
          <label className="block">
            <span className="eyebrow">{t("admin.emailSubject")}</span>
            <input
              className={field}
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.emailHeading")}</span>
            <input
              className={field}
              value={draft.heading}
              onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.emailBody")}</span>
            <textarea
              rows={8}
              className={`${field} resize-y leading-6`}
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.emailButton")}</span>
            <input
              className={field}
              value={draft.button_label}
              onChange={(e) => setDraft({ ...draft, button_label: e.target.value })}
            />
          </label>
          <label className="block">
            <span className="eyebrow">{t("admin.emailFooter")}</span>
            <textarea
              rows={3}
              className={`${field} resize-y leading-6`}
              value={draft.footer}
              onChange={(e) => setDraft({ ...draft, footer: e.target.value })}
            />
          </label>
          <div className="flex items-center gap-6">
            <button
              type="button"
              className={button}
              disabled={
                busy ||
                !draft.subject.trim() ||
                !draft.heading.trim() ||
                !draft.body.trim() ||
                !draft.button_label.trim()
              }
              onClick={() => void save()}
            >
              {t("admin.save")}
            </button>
            <button
              type="button"
              className={ghost}
              onClick={() => setDraft({ ...DEFAULT_INVITE_TEMPLATES[lang] })}
            >
              {t("admin.emailReset")}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <SectionTitle>{t("admin.emailPreview")}</SectionTitle>
          <div className="border border-hairline bg-white">
            <div className="border-b border-hairline px-5 py-3">
              <p className="eyebrow">{t("admin.emailSubject")}</p>
              <p className="mt-1 text-sm text-foreground">{preview.subject}</p>
            </div>
            <div className="space-y-5 px-5 py-7">
              <div className="brand-rule h-[2px] w-full" />
              <h2 className="font-display text-2xl">{preview.heading}</h2>
              {preview.body.split(/\n{2,}/).map((paragraph, i) => (
                <p key={i} className="text-[15px] leading-6 whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
              <span className="inline-block border border-violet bg-violet px-5 py-3 text-[11px] tracking-[0.14em] text-primary-foreground uppercase">
                {preview.button_label}
              </span>
              <p className="text-xs whitespace-pre-line text-muted-foreground">{preview.footer}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("admin.emailPreviewNote")}</p>
        </section>
      </div>
    </div>
  );
}

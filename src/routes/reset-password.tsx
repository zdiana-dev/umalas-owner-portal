import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Field } from "@/components/portal/Field";
import { BrandButton } from "@/components/portal/BrandButton";
import { LangToggle } from "@/components/portal/LangToggle";
import officialLockup from "@/assets/umalas-lockup-official.png.asset.json";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Create a new password | The Umalas Signature" },
      { name: "description", content: "Securely create a new password for the Owner Portal." },
      { property: "og:title", content: "Create a new password | The Umalas Signature" },
      { property: "og:description", content: "Secure Owner Portal password recovery." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [valid, setValid] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const recoveryLink = hash.get("type") === "recovery" || new URLSearchParams(window.location.search).get("type") === "recovery";
    void supabase.auth.getSession().then(({ data }) => setValid(Boolean(data.session) && recoveryLink));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error(t("profile.passwordShort"));
      return;
    }
    if (password !== confirmation) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) toast.error(t("common.error"));
    else {
      setSaved(true);
      toast.success(t("reset.saved"));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-12">
      <div className="relative w-full max-w-md border border-hairline bg-background p-6 sm:p-10">
        <LangToggle className="absolute right-5 top-5" />
        <img src={officialLockup.url} alt={t("brand.name")} className="mx-auto h-auto w-36" />
        <div className="brand-rule mx-auto mt-5 h-px w-28" />
        <h1 className="type-section mt-9 text-center">{t("reset.title")}</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">{t("reset.subtitle")}</p>

        {valid === false ? (
          <p className="mt-8 border-y border-hairline py-5 text-center text-sm text-muted-foreground">{t("reset.invalid")}</p>
        ) : saved ? (
          <p className="mt-8 border-y border-hairline py-5 text-center text-sm">{t("reset.saved")}</p>
        ) : (
          <form onSubmit={save} className="mt-8 space-y-3">
            <Field label={t("profile.newPassword")} type="password" autoComplete="new-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
            <Field label={t("profile.confirmPassword")} type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
            <p className="pb-2 text-xs text-muted-foreground">{t("profile.passwordHint")}</p>
            <BrandButton type="submit" busy={busy} disabled={valid !== true}>{t("reset.save")}</BrandButton>
          </form>
        )}

        <Link to="/" className="eyebrow mt-8 block text-center text-violet hover:underline">{t("reset.back")}</Link>
      </div>
    </main>
  );
}
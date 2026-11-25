import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n, type Lang } from "@/lib/i18n";
import { profileQuery } from "@/lib/portal-queries";
import { SectionTitle } from "@/components/portal/Figures";

import { ActivityJournal } from "@/components/portal/ActivityJournal";
import { PaymentDocuments } from "@/components/portal/PaymentDocuments";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Profile — Owner Portal | The Umalas Signature" },
      {
        name: "description",
        content:
          "Update your name, contact details, interface language and password in the Owner Portal of The Umalas Signature.",
      },
      { property: "og:title", content: "Profile — Owner Portal | The Umalas Signature" },
      {
        property: "og:description",
        content: "Manage your owner account details and password.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProfilePage,
});

const field =
  "mt-2 w-full border-b border-input bg-transparent pb-2 text-sm outline-none focus:border-violet";
const button =
  "border border-violet bg-violet px-4 py-2 text-[11px] tracking-[0.14em] text-primary-foreground uppercase transition-colors hover:bg-violet-deep disabled:opacity-50";

function ProfilePage() {
  const { t, lang, setLang } = useI18n();
  const queryClient = useQueryClient();
  const { data: profile, isLoading } = useQuery(profileQuery());

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState<Lang>(lang);
  const [savingDetails, setSavingDetails] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setPhone(profile.phone ?? "");
    setLanguage(profile.preferred_language === "en" ? "en" : "ru");
  }, [profile]);

  async function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSavingDetails(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          preferred_language: language,
        })
        .eq("user_id", profile.user_id);
      if (error) throw error;
      setLang(language);
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("profile.saved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSavingDetails(false);
    }
  }

  async function savePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error(t("profile.passwordShort"));
      return;
    }
    if (password !== passwordConfirm) {
      toast.error(t("profile.passwordMismatch"));
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPassword("");
      setPasswordConfirm("");
      toast.success(t("profile.passwordSaved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setSavingPassword(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }

  return (
    <div className="space-y-12">
      <div className="space-y-6">
        <SectionTitle>{t("profile.title")}</SectionTitle>

        <form onSubmit={saveDetails} className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">{t("profile.name")}</span>
              <input
                className={field}
                value={fullName}
                maxLength={120}
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="eyebrow">{t("profile.email")}</span>
              <input
                className={`${field} text-muted-foreground`}
                value={profile?.email ?? ""}
                readOnly
                disabled
              />
            </label>

            <label className="block">
              <span className="eyebrow">{t("profile.phone")}</span>
              <input
                className={field}
                value={phone}
                maxLength={40}
                inputMode="tel"
                onChange={(event) => setPhone(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="eyebrow">{t("profile.language")}</span>
              <select
                className={field}
                value={language}
                onChange={(event) => setLanguage(event.target.value as Lang)}
              >
                <option value="ru">Русский</option>
                <option value="en">English</option>
              </select>
            </label>

            <div className="block">
              <span className="eyebrow">{t("profile.role")}</span>
              <p className={`${field} flex items-center gap-2`}>
                <span
                  className={`inline-block border px-2 py-0.5 text-[10px] tracking-[0.14em] uppercase ${
                    profile?.role === "admin"
                      ? "border-violet text-violet"
                      : "border-hairline text-muted-foreground"
                  }`}
                >
                  {profile?.role === "admin" ? t("profile.roleAdmin") : t("profile.roleOwner")}
                </span>
              </p>
            </div>
          </div>


          <button type="submit" className={button} disabled={savingDetails || !fullName.trim()}>
            {t("profile.save")}
          </button>
        </form>
      </div>

      {profile ? (
        <div className="space-y-6 border-t border-hairline pt-10">
          <SectionTitle>{t("paydocs.title")}</SectionTitle>
          <PaymentDocuments ownerId={profile.user_id} />
        </div>
      ) : null}

      <ActivityJournal />

      <div className="space-y-6 border-t border-hairline pt-10">
        <SectionTitle>{t("profile.passwordTitle")}</SectionTitle>

        <form onSubmit={savePassword} className="space-y-8">
          <div className="grid gap-6 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow">{t("profile.newPassword")}</span>
              <input
                type="password"
                className={field}
                value={password}
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            <label className="block">
              <span className="eyebrow">{t("profile.confirmPassword")}</span>
              <input
                type="password"
                className={field}
                value={passwordConfirm}
                autoComplete="new-password"
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">{t("profile.passwordHint")}</p>

          <button type="submit" className={button} disabled={savingPassword}>
            {t("profile.passwordSave")}
          </button>
        </form>
      </div>
    </div>
  );
}

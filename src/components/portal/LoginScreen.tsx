import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { BrandButton } from "@/components/portal/BrandButton";
import { Field } from "@/components/portal/Field";
import { LangToggle } from "@/components/portal/LangToggle";
import { LoginBackground } from "@/components/portal/LoginBackground";

type LoginBrand = {
  name: string;
  company: string;
  companyUrl?: string;
  logoUrl: string;
  logoAlt: string;
  logoClassName?: string;
  desktopImage?: string;
  mobileImage?: string;
  imageAlt?: string;
  place?: string;
  redirectPath?: string;
};

/** Sequenced entrance: 950ms fade-up per element, 160ms stagger. */
function step(index: number) {
  return { animationDelay: `${index * 160}ms` } as CSSProperties;
}

export function LoginScreen({ brand }: { brand: LoginBrand }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"password" | "magic" | "signup">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function navigateAfterSignIn(userId: string) {
    const { data: staff } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (staff?.some((row) => row.role === "finance")) {
      navigate({ to: "/finance", replace: true });
      return;
    }
    if (staff?.some((row) => row.role === "luxso")) {
      navigate({ to: "/management", replace: true });
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();
    navigate({ to: profile?.role === "admin" ? "/admin" : "/dashboard", replace: true });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigateAfterSignIn(data.session.user.id);
    });
  }, [navigate]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const redirectUrl = `${window.location.origin}${brand.redirectPath ?? ""}`;
      if (mode === "signup") {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: redirectUrl,
            data: { full_name: fullName.trim() },
          },
        });
        if (err) throw err;
        if (data.session) {
          await navigateAfterSignIn(data.session.user.id);
          return;
        }
        toast.success(t("login.signUpDone"));
        setMode("password");
      } else if (mode === "magic") {
        const { error: err } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectUrl },
        });
        if (err) throw err;
        toast.success(t("login.magicSent"));
      } else {
        const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        await navigateAfterSignIn(data.user.id);
      }
    } catch {
      const message = mode === "signup" ? t("login.signUpError") : t("login.error");
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen bg-background lg:flex">
      <div className="absolute inset-0 lg:relative lg:h-auto lg:min-h-screen lg:w-[58%] lg:shrink-0">
        <LoginBackground
          caption={brand.place ?? t("login.place")}
          brandName={brand.name}
          {...(brand.desktopImage ? { desktopImage: brand.desktopImage } : {})}
          {...(brand.mobileImage ? { mobileImage: brand.mobileImage } : {})}
          {...(brand.imageAlt ? { imageAlt: brand.imageAlt } : {})}
        />
      </div>

      <div className="relative flex min-h-screen w-full items-center justify-center px-4 py-10 sm:px-8 lg:min-h-screen lg:w-[42%] lg:bg-background lg:px-12">
        <div className="login-panel relative w-full max-w-[20.5rem] rounded-sm border border-background/45 bg-background/65 p-5 pt-12 sm:p-8 sm:pt-14 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:pt-10">
          <LangToggle className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-0 lg:right-0" />

          <div className="anim-fade-up mb-8 flex flex-col items-center" style={step(0)}>
            <img
              src={brand.logoUrl}
              alt={brand.logoAlt}
              className={brand.logoClassName ?? "block h-auto w-[132px] sm:w-[148px]"}
            />
            <div className="brand-rule anim-rule-draw mt-3 h-px w-32" style={step(1)} />
            <p className="eyebrow mt-3 text-[10px]">{brand.company}</p>
          </div>

          <h1 className="type-section anim-fade-up text-center text-balance sm:type-display" style={step(2)}>
            {t("login.title")}
          </h1>
          <p className="type-body anim-fade-up mt-3 text-center text-balance text-muted-foreground" style={step(3)}>
            {t("login.subtitle")}
          </p>

          <form onSubmit={onSubmit} className="mt-10 space-y-2">
            {mode === "signup" ? (
              <div className="anim-fade-up" style={step(4)}>
                <Field label={t("login.name")} type="text" required autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} />
              </div>
            ) : null}

            <div className="anim-fade-up" style={step(5)}>
              <Field label={t("login.email")} type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} error={error ?? undefined} />
            </div>

            {mode === "magic" ? (
              <p className="anim-fade-up pb-4 text-xs leading-5 text-muted-foreground" style={step(6)}>{t("login.magicHint")}</p>
            ) : (
              <div className="anim-fade-up" style={step(6)}>
                <Field label={t("login.password")} type="password" required autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} />
              </div>
            )}

            <div className="anim-fade-up pt-2" style={step(7)}>
              <BrandButton type="submit" busy={busy}>
                {mode === "signup" ? t("login.signUp") : mode === "password" ? t("login.submit") : t("login.magic")}
              </BrandButton>
            </div>

            <div className="anim-fade-up space-y-3 pt-6" style={step(8)}>
              <button type="button" onClick={() => { setError(null); setMode(mode === "password" ? "magic" : "password"); }} className="w-full text-center text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors duration-200 hover:text-violet">
                {mode === "password" ? t("login.magic") : t("login.usePassword")}
              </button>
              <button type="button" onClick={() => { setError(null); setMode(mode === "signup" ? "password" : "signup"); }} className="w-full text-center text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors duration-200 hover:text-violet">
                {mode === "signup" ? t("login.haveAccount") : t("login.signUpSwitch")}
              </button>
            </div>
          </form>

          <p className="mt-10 text-center text-[10px] leading-relaxed tracking-[0.1em] text-muted-foreground uppercase">
            {brand.name}{brand.company ? " — " : ""}
            {brand.companyUrl ? (
              <a href={brand.companyUrl} target="_blank" rel="noopener noreferrer" className="inline-block transition-colors duration-200 hover:text-violet">{brand.company}</a>
            ) : brand.company}
          </p>
        </div>
      </div>
    </main>
  );
}
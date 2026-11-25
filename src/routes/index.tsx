import { createFileRoute } from "@tanstack/react-router";

import officialLockup from "@/assets/umalas-lockup-official.png.asset.json";
import { LoginScreen } from "@/components/portal/LoginScreen";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — Owner Portal | The Umalas Signature" },
      { name: "description", content: "Private sign-in for owners of The Umalas Signature rental pool, managed by LUXSO." },
      { property: "og:title", content: "Sign in — Owner Portal | The Umalas Signature" },
      { property: "og:description", content: "Private sign-in for owners of The Umalas Signature rental pool, managed by LUXSO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useI18n();
  return (
    <LoginScreen
      brand={{
        name: t("brand.name"),
        company: t("brand.company"),
        companyUrl: t("brand.companyUrl"),
        logoUrl: officialLockup.url,
        logoAlt: t("brand.name"),
      }}
    />
  );
}
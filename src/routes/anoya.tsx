import { createFileRoute } from "@tanstack/react-router";

import anoyaLogo from "@/assets/anoya-logo.png.asset.json";
import anoyaCover from "@/assets/anoya-villa-photo.png.asset.json";
import { LoginScreen } from "@/components/portal/LoginScreen";

export const Route = createFileRoute("/anoya")({
  head: () => ({
    meta: [
      { title: "Sign in — Anoya Villas Owner Portal" },
      { name: "description", content: "Private owner sign-in for Anoya Villas in Bali." },
      { property: "og:title", content: "Sign in — Anoya Villas Owner Portal" },
      { property: "og:description", content: "Private owner sign-in for Anoya Villas in Bali." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnoyaLoginPage,
});

function AnoyaLoginPage() {
  return (
    <LoginScreen
      brand={{
        name: "Anoya Villas",
        company: "",
        logoUrl: anoyaLogo.url,
        logoAlt: "Anoya Boutique Villa",
        logoClassName: "block h-auto w-[176px] sm:w-[204px]",
        desktopImage: anoyaCover.url,
        mobileImage: anoyaCover.url,
        imageAlt: "Anoya Villas in Bali",
        place: "Bali, Indonesia",
        redirectPath: "/anoya",
      }}
    />
  );
}
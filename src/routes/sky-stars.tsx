import { createFileRoute } from "@tanstack/react-router";

import skyStarsLogo from "@/assets/sky-stars-logo.png";
import skyStarsCover from "@/assets/skystar-villa-cover.jpg.asset.json";
import { LoginScreen } from "@/components/portal/LoginScreen";

export const Route = createFileRoute("/sky-stars")({
  head: () => ({
    meta: [
      { title: "Sign in — Sky Stars Villas Owner Portal" },
      { name: "description", content: "Private owner sign-in for Sky Stars Villas, managed by LUXSO." },
      { property: "og:title", content: "Sign in — Sky Stars Villas Owner Portal" },
      { property: "og:description", content: "Private owner sign-in for Sky Stars Villas, managed by LUXSO." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SkyStarsLoginPage,
});

function SkyStarsLoginPage() {
  return (
    <LoginScreen
      brand={{
        name: "Sky Stars Villas",
        company: "Managed by LUXSO",
        companyUrl: "https://luxsomanagement.com/",
        logoUrl: skyStarsLogo,
        logoAlt: "Sky Stars Villas",
        logoClassName: "block h-auto w-[158px] brightness-0 sm:w-[178px]",
        desktopImage: skyStarsCover.url,
        mobileImage: skyStarsCover.url,
        imageAlt: "Sky Stars Villas in Ungasan, Bali",
        place: "Ungasan, Bali",
        redirectPath: "/sky-stars",
      }}
    />
  );
}
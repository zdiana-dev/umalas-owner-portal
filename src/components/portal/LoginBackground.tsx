import desktopAsset from "@/assets/umalas-login.jpg.asset.json";
import mobileAsset from "@/assets/umalas-login-mobile.jpg.asset.json";

import { ArcMark } from "@/components/portal/ArcMark";

/**
 * Login photography. Swapping the client's renders in later is a two-line change:
 * point these two constants at other asset pointers.
 */
const LOGIN_IMAGE_DESKTOP = desktopAsset.url;
const LOGIN_IMAGE_MOBILE = mobileAsset.url;

/** Full-bleed evening render with the brand scrim; never raw photo under type. */
export function LoginBackground({
  caption,
  desktopImage = LOGIN_IMAGE_DESKTOP,
  mobileImage = LOGIN_IMAGE_MOBILE,
  imageAlt = "The Umalas Signature at dusk, Umalas, Bali",
  brandName = "The Umalas Signature",
}: {
  caption: string;
  desktopImage?: string;
  mobileImage?: string;
  imageAlt?: string;
  brandName?: string;
}) {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <picture>
        <source media="(min-width: 1024px)" srcSet={desktopImage} />
        <img
          src={mobileImage}
          alt={imageAlt}
          className="anim-ken-burns h-full w-full object-cover"
          fetchPriority="high"
        />
      </picture>

      {/* Brand gradient scrim — heavier on mobile where type sits over the image */}
      <div
        className="absolute inset-0 lg:hidden"
        style={{ background: "var(--scrim-login-mobile)" }}
      />
      <div
        className="absolute inset-0 hidden lg:block"
        style={{ background: "var(--scrim-login)" }}
      />
      {/* Soft vertical darkening for the caption */}
      <div
        className="absolute inset-x-0 bottom-0 h-2/5"
        style={{ background: "linear-gradient(180deg, rgba(20,15,28,0) 0%, rgba(20,15,28,0.62) 100%)" }}
      />

      <div className="absolute bottom-8 left-6 hidden lg:block sm:bottom-10 sm:left-10">
        {brandName === "The Umalas Signature" ? (
          <ArcMark size={40} tone="white" className="anim-fade-up" />
        ) : null}
        <p
          className="wordmark anim-fade-up mt-4 text-[13px] text-white sm:text-sm"
          style={{ animationDelay: "160ms" }}
        >
          {brandName}
        </p>
        <div
          className="brand-rule anim-rule-draw mt-3 h-px w-40"
          style={{ animationDelay: "320ms" }}
        />
        <p
          className="anim-fade-up mt-3 text-[12px] font-light tracking-[0.18em] text-white/70"
          style={{ animationDelay: "480ms" }}
        >
          {caption}
        </p>
      </div>
    </div>
  );
}

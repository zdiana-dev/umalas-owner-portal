import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useI18n } from "@/lib/i18n";
import { profileQuery } from "@/lib/portal-queries";
import { myMessagesQuery, markThreadRead } from "@/lib/messages";
import { SkeletonLines } from "@/components/portal/Figures";
import { MessageThread } from "@/components/portal/MessageThread";
import { SUPPORT_WHATSAPP } from "@/lib/support";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — Owner Portal | The Umalas Signature" },
      {
        name: "description",
        content:
          "Write to the management team of The Umalas Signature and read their replies in your private owner cabinet.",
      },
      { property: "og:title", content: "Messages — Owner Portal | The Umalas Signature" },
      { property: "og:description", content: "Private conversation with the management team." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MessagesPage,
});

function MessagesPage() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const profile = useQuery(profileQuery());
  const messages = useQuery(myMessagesQuery());

  const rows = messages.data ?? [];

  useEffect(() => {
    const unread = rows.filter((m) => m.from_admin && !m.read_at).map((m) => m.id);
    if (unread.length > 0) void markThreadRead(unread);
  }, [rows]);

  if (profile.isLoading || messages.isLoading) return <SkeletonLines rows={4} />;
  const ownerId = profile.data?.user_id;
  if (!ownerId) return null;

  return (
    <div className="anim-rise space-y-8">
      <div>
        <h1 className="font-display text-2xl">{t("nav.messages")}</h1>
        <div className="brand-rule mt-4 h-[2px] w-full" />
        <p className="mt-4 text-sm text-muted-foreground">{t("messages.intro")}</p>
      </div>

      <MessageThread
        messages={rows}
        ownerId={ownerId}
        asAdmin={false}
        lang={lang}
        onSent={() => void qc.invalidateQueries({ queryKey: ["messages"] })}
      />

      <a
        href={`https://wa.me/${SUPPORT_WHATSAPP}`}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-sm text-emerald-600 underline-offset-4 hover:underline"
      >
        {t("support.whatsapp")}
      </a>
    </div>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePayout } from "@/lib/payout-extract";

export { parsePayout } from "@/lib/payout-extract";

/** Reads ROI statement PDFs for a unit and stores the payable amount on each report. */
export const extractUnitPayouts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        unitId: z.string().uuid(),
        overwrite: z.boolean().default(false),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "admin") throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { extractText, getDocumentProxy } = await import("unpdf");

    const { data: reports, error } = await supabaseAdmin
      .from("reports")
      .select("id, period_label, file_path, net_payout")
      .eq("unit_id", data.unitId)
      .eq("report_type", "roi");
    if (error) throw new Error(error.message);

    const results: { id: string; period_label: string; amount: number | null }[] = [];

    for (const report of reports ?? []) {
      if (!data.overwrite && report.net_payout != null) continue;
      if (!report.file_path?.toLowerCase().endsWith(".pdf")) {
        results.push({ id: report.id, period_label: report.period_label, amount: null });
        continue;
      }
      try {
        const file = await supabaseAdmin.storage.from("reports").download(report.file_path);
        if (file.error || !file.data) throw new Error(file.error?.message ?? "download failed");
        const bytes = new Uint8Array(await file.data.arrayBuffer());
        const doc = await getDocumentProxy(bytes);
        const { text } = await extractText(doc, { mergePages: true });
        const amount = parsePayout(Array.isArray(text) ? text.join("\n") : String(text));
        if (amount != null) {
          const { error: updateError } = await supabaseAdmin
            .from("reports")
            .update({ net_payout: amount })
            .eq("id", report.id);
          if (updateError) throw new Error(updateError.message);
        }
        results.push({ id: report.id, period_label: report.period_label, amount });
      } catch {
        results.push({ id: report.id, period_label: report.period_label, amount: null });
      }
    }

    return {
      filled: results.filter((r) => r.amount != null).length,
      failed: results.filter((r) => r.amount == null).map((r) => r.period_label),
    };
  });

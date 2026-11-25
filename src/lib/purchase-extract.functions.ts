import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parsePurchaseFacts, type PurchaseFacts } from "@/lib/purchase-extract";

/** Contract-like categories, most authoritative for purchase terms first. */
const CATEGORY_ORDER = [
  "resale_agreement",
  "lease_agreement",
  "mou",
  "booking_form",
  "addendum",
  "bast",
  "management_agreement",
  "other",
];

export type PurchaseSuggestion = PurchaseFacts & {
  /** Document title the facts were read from. */
  source: string;
  documentId: string;
};

/**
 * Reads a unit's contract PDFs and returns the purchase price, currency, VAT rate
 * and date found in them. Read-only: the admin decides whether to apply them.
 */
export const readUnitPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ unitId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ suggestion: PurchaseSuggestion | null; scanned: number }> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("role")
      .eq("user_id", context.userId)
      .maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "admin") throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { extractText, getDocumentProxy } = await import("unpdf");

    const { data: docs, error } = await supabaseAdmin
      .from("documents")
      .select("id, title, category, file_path")
      .eq("unit_id", data.unitId);
    if (error) throw new Error(error.message);

    const pdfs = (docs ?? [])
      .filter((d) => (d.file_path ?? "").toLowerCase().endsWith(".pdf"))
      .sort(
        (a, b) =>
          CATEGORY_ORDER.indexOf(String(a.category)) - CATEGORY_ORDER.indexOf(String(b.category)),
      );

    let scanned = 0;
    // Merge across documents: the first file that states a fact wins, in category order.
    const merged: PurchaseSuggestion = {
      price: null,
      currency: null,
      vatRate: null,
      date: null,
      source: "",
      documentId: "",
    };

    for (const doc of pdfs) {
      if (merged.price != null && merged.date != null && merged.vatRate != null) break;
      try {
        const file = await supabaseAdmin.storage.from("documents").download(doc.file_path);
        if (file.error || !file.data) continue;
        const bytes = new Uint8Array(await file.data.arrayBuffer());
        const pdf = await getDocumentProxy(bytes);
        const { text } = await extractText(pdf, { mergePages: true });
        scanned += 1;
        const facts = parsePurchaseFacts(Array.isArray(text) ? text.join("\n") : String(text));
        let used = false;
        if (merged.price == null && facts.price != null) {
          merged.price = facts.price;
          merged.currency = facts.currency ?? merged.currency;
          used = true;
        }
        if (merged.vatRate == null && facts.vatRate != null) {
          merged.vatRate = facts.vatRate;
          used = true;
        }
        if (merged.date == null && facts.date != null) {
          merged.date = facts.date;
          used = true;
        }
        if (used && !merged.source) {
          merged.source = doc.title;
          merged.documentId = doc.id;
        }
      } catch {
        // A single unreadable PDF must not stop the scan.
      }
    }

    const found = merged.price != null || merged.vatRate != null || merged.date != null;
    return { suggestion: found ? merged : null, scanned };
  });

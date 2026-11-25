import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const idInput = (input: unknown) => z.object({ id: z.string().uuid() }).parse(input);

async function signedUrl(bucket: string, path: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUrl(path, 300);
  if (error || !data) throw new Error("File unavailable");
  return { url: data.signedUrl };
}

/**
 * Signed URL for a document. The read runs as the signed-in user, so
 * row-level security decides whether the document is theirs and published.
 */
export const getDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("documents")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !doc) throw new Error("Not found");
    return signedUrl("documents", doc.file_path);
  });

/** Signed URL for a report file, gated by the same ownership check. */
export const getReportUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { data: report, error } = await context.supabase
      .from("reports")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !report) throw new Error("Not found");
    return signedUrl("reports", report.file_path);
  });

/** Signed URL for the payment receipt attached to a report, same ownership gate. */
export const getReportReceiptUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { data: report, error } = await context.supabase
      .from("reports")
      .select("receipt_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !report?.receipt_path) throw new Error("Not found");
    return signedUrl("reports", report.receipt_path);
  });

/** Signed URL for a per-owner payment-details file; RLS limits to the owner and admins. */
export const getPaymentDocUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(idInput)
  .handler(async ({ data, context }) => {
    const { data: doc, error } = await context.supabase
      .from("payment_documents")
      .select("file_path")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !doc) throw new Error("Not found");
    return signedUrl("payment-details", doc.file_path);
  });

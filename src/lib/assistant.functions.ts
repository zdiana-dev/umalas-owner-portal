import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { extractText, getDocumentProxy } from "unpdf";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** How much text from one PDF is worth sending to the model. */
const PER_FILE_CHARS = 6000;
const MAX_DOC_FILES = 8;
const MAX_REPORT_FILES = 4;
/** Below this many characters a PDF counts as a scan with no text layer. */
const SCAN_TEXT_THRESHOLD = 200;
/** Largest scan worth sending to the model as a file. */
const MAX_SCAN_BYTES = 6_000_000;
/** How many scans one answer may read. */
const MAX_SCAN_FILES = 3;
/** How many past messages of the continuous chat are sent back to the model. */
const HISTORY_MESSAGES = 20;

const askInput = (input: unknown) =>
  z
    .object({
      question: z.string().min(2).max(1000),
      lang: z.enum(["ru", "en"]).default("ru"),
    })
    .parse(input);

export type Cited = { kind: "document" | "report"; id: string; title: string };
export type ChatTurn = { role: "user" | "assistant"; text: string; sources?: Cited[] };

/**
 * General knowledge the bot may use alongside the owner's own files.
 * Editable: extend these notes as projects and rules evolve.
 */
const PROJECT_KNOWLEDGE = `
# PROJECTS
- The Umalas Signature — boutique villa complex in Umalas, Bali. Rental pool managed by LUXSO.
- Anoya Villas — 10 villas (codes 901–910), same management.
- Sky Stars Villas — 19 villas (1BR, 2BR and 3BR), managed by LUXSO.
- Amara Villas — project in preparation.

# POLICIES AND RULES
- ROI reports are produced quarterly: Apr–Jun, Jul–Sep, Oct–Dec (some periods may follow other groupings such as Sep–Nov).
- Payouts are made in IDR to the owner's bank details on file. The payout date shown in the cabinet is the actual date the money was sent.
- A payout shown as "in progress" means it is inside a published payment plan and will be paid within 2 days.
- ROI payouts are subject to VAT where applicable (standard rate 10–11% depending on contract; investment contracts may be without VAT).
- Each villa has a rental-pool coefficient that defines its share of the pool income.
- Owners can upload payment-related documents and bank details in the Documents section.
- For anything the bot cannot answer (contract changes, resale, urgent payment issues), the owner should message the management team via the Messages section or email z.diana@magnumestate.pro.
`;

function money(value: number | null, currency: string | null) {
  if (value == null) return "—";
  return `${value.toLocaleString("en-US").replace(/,/g, " ")} ${currency ?? ""}`.trim();
}

/** Ranks files so the ones the question is likely about are read first. */
function rank<T extends { title: string }>(rows: T[], question: string): T[] {
  const words = question
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2);
  return [...rows].sort((a, b) => score(b.title) - score(a.title));
  function score(title: string) {
    const lower = title.toLowerCase();
    return words.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
  }
}

/**
 * Reads a PDF. Scanned files carry no text layer, so the raw bytes are kept as
 * well and sent to the model, which reads them like a person looking at a scan.
 */
async function pdfRead(
  bucket: string,
  path: string,
): Promise<{ text: string; bytes?: Uint8Array | undefined }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const file = await supabaseAdmin.storage.from(bucket).download(path);
  if (file.error || !file.data) return { text: "" };
  const bytes = new Uint8Array(await file.data.arrayBuffer());
  const size = bytes.byteLength;
  // The PDF reader takes ownership of the buffer it parses, so keep a spare copy.
  const spare = size <= MAX_SCAN_BYTES ? new Uint8Array(bytes) : undefined;
  let merged = "";
  try {
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    merged = Array.isArray(text) ? text.join("\n") : String(text);
  } catch {
    // A malformed text layer still leaves the scan itself readable.
  }
  const clean = merged.replace(/\s+\n/g, "\n").slice(0, PER_FILE_CHARS);
  if (clean.trim().length >= SCAN_TEXT_THRESHOLD) return { text: clean };
  return { text: clean, bytes: spare };
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type SupabaseLike = {
  from: (table: string) => any;
};

/** Loads the tail of the owner's continuous conversation, oldest first. */
async function loadHistory(supabase: SupabaseLike, ownerId: string): Promise<ChatTurn[]> {
  const { data } = await supabase
    .from("chat_messages")
    .select("role, content, sources")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MESSAGES);
  return (data ?? [])
    .reverse()
    .map((m: { role: string; content: string; sources: unknown }) => ({
      role: m.role as "user" | "assistant",
      text: m.content,
      sources: Array.isArray(m.sources) ? (m.sources as Cited[]) : [],
    }));
}

/** The owner's saved conversation, for rendering the chat page. */
export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const turns = await loadHistory(context.supabase, context.userId);
    return { turns };
  });

/** Clears the owner's conversation so they can start fresh. */
export const clearChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("chat_messages").delete().eq("owner_id", context.userId);
    return { ok: true as const };
  });

/** Admin-only: read one owner's conversation with the assistant. */
export const getOwnerChatLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ ownerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", {
      _user_id: context.userId,
    });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: rows } = await context.supabase
      .from("chat_messages")
      .select("role, content, created_at")
      .eq("owner_id", data.ownerId)
      .order("created_at", { ascending: true })
      .limit(200);
    return {
      turns: (rows ?? []).map((m: { role: string; content: string; created_at: string }) => ({
        role: m.role as "user" | "assistant",
        text: m.content,
        at: m.created_at,
      })),
    };
  });

/**
 * Answers an owner question using their own units, documents and reports plus
 * general project knowledge. Reads run through the owner's session, so
 * row-level security decides what the model is allowed to see. Both the
 * question and the answer are appended to the owner's saved conversation.
 */
export const askMyDocuments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(askInput)
  .handler(async ({ data, context }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI assistant is not configured");

    const { data: links } = await context.supabase
      .from("ownerships")
      .select("unit_id")
      .eq("owner_id", context.userId)
      .is("end_date", null);
    const unitIds = (links ?? []).map((l) => l.unit_id as string);
    if (unitIds.length === 0) return { answer: "", sources: [] as Cited[], empty: true as const };

    const history = await loadHistory(context.supabase, context.userId);

    const [{ data: units }, { data: docs }, { data: reports }] = await Promise.all([
      context.supabase
        .from("units")
        .select(
          "id, code, building, floor, unit_type, purchase_price, purchase_currency, purchase_date, vat_rate, coefficient, ma_number, ma_start, ma_end",
        )
        .in("id", unitIds),
      context.supabase
        .from("documents")
        .select("id, unit_id, category, title, issued_date, file_path")
        .eq("is_published", true)
        .order("issued_date", { ascending: false }),
      context.supabase
        .from("reports")
        .select(
          "id, unit_id, report_type, period_label, period_start, period_end, net_payout, currency, is_paid, paid_at, due_date, file_path",
        )
        .eq("is_published", true)
        .order("period_start", { ascending: false }),
    ]);

    const unitRows = units ?? [];
    const codeOf = new Map(unitRows.map((u) => [u.id as string, u.code as string]));

    const lines: string[] = [];
    lines.push("# UNITS");
    for (const u of unitRows) {
      lines.push(
        `- ${u.code}: type ${u.unit_type ?? "—"}, block ${u.building ?? "—"}, floor ${u.floor ?? "—"}, purchase ${money(u.purchase_price as number | null, u.purchase_currency as string | null)}, VAT ${u.vat_rate ?? "—"}%, purchase date ${u.purchase_date ?? "—"}, coefficient ${u.coefficient ?? "—"}, management agreement ${u.ma_number ?? "—"} (${u.ma_start ?? "—"} — ${u.ma_end ?? "—"})`,
      );
    }

    lines.push("", "# REPORTS");
    for (const r of reports ?? []) {
      lines.push(
        `- [report ${r.id}] ${codeOf.get(r.unit_id as string) ?? ""} ${String(r.report_type).toUpperCase()} ${r.period_label} (${r.period_start ?? "—"} — ${r.period_end ?? "—"}): payout ${money(r.net_payout as number | null, r.currency as string | null)}, ${r.is_paid ? `paid ${r.paid_at ?? ""}` : `unpaid, due ${r.due_date ?? "—"}`}`,
      );
    }

    lines.push("", "# DOCUMENTS");
    for (const d of docs ?? []) {
      lines.push(
        `- [document ${d.id}] ${codeOf.get(d.unit_id as string) ?? "general"} ${d.category}: ${d.title} (${d.issued_date ?? "no date"})`,
      );
    }

    const sources: Cited[] = [];
    const docPicks = rank(
      (docs ?? []).filter((d) => String(d.file_path).toLowerCase().endsWith(".pdf")),
      data.question,
    ).slice(0, MAX_DOC_FILES);
    const reportPicks = rank(
      (reports ?? []).map((r) => ({
        ...r,
        title: `${String(r.report_type).toUpperCase()} ${r.period_label} ${codeOf.get(r.unit_id as string) ?? ""}`,
      })),
      data.question,
    ).slice(0, MAX_REPORT_FILES);

    /** Scanned files the model has to look at instead of reading text. */
    const scans: { filename: string; data: string }[] = [];

    lines.push("", "# FILE CONTENTS");
    for (const d of docPicks) {
      try {
        const { text, bytes } = await pdfRead("documents", d.file_path as string);
        const scanned = bytes && scans.length < MAX_SCAN_FILES;
        if (!text.trim() && !scanned) continue;
        sources.push({ kind: "document", id: d.id as string, title: d.title as string });
        if (text.trim()) lines.push(`\n## document ${d.id} — ${d.title}\n${text}`);
        if (scanned) {
          const filename = `document-${d.id}.pdf`;
          scans.push({ filename, data: toBase64(bytes) });
          lines.push(
            `\n## document ${d.id} — ${d.title}\nScanned file attached to this request as ${filename}; read it from the attachment.`,
          );
        }
      } catch {
        // An unreadable file must not break the answer.
      }
    }
    for (const r of reportPicks) {
      try {
        const { text, bytes } = await pdfRead("reports", r.file_path as string);
        const scanned = bytes && scans.length < MAX_SCAN_FILES;
        if (!text.trim() && !scanned) continue;
        sources.push({ kind: "report", id: r.id as string, title: r.title });
        if (text.trim()) lines.push(`\n## report ${r.id} — ${r.title}\n${text}`);
        if (scanned) {
          const filename = `report-${r.id}.pdf`;
          scans.push({ filename, data: toBase64(bytes) });
          lines.push(
            `\n## report ${r.id} — ${r.title}\nScanned file attached to this request as ${filename}; read it from the attachment.`,
          );
        }
      } catch {
        // Same here.
      }
    }

    const system =
      "You are the assistant of The Umalas Signature owner portal (Bali villa rental pool, managed by LUXSO). " +
      "You chat with villa owners. Answer from two sources only: (1) the OWNER DATA below — their units, ROI/IPL reports and documents, and (2) the PROJECT KNOWLEDGE below — general project and policy information. " +
      "Never invent numbers, dates or clauses. If neither source contains the answer, say so plainly and suggest messaging the management team. " +
      "Quote amounts with their currency exactly as recorded, use spaces as thousand separators. " +
      "Name the document or report period you relied on. Keep answers short and concrete, formatted in markdown (short lists and bold are welcome). " +
      "Some of the owner's files are scans without a text layer and are attached to this request as PDF files; read them from the attachments and treat them as the owner's own documents. " +
      (data.lang === "ru" ? "Reply in Russian." : "Reply in English.") +
      "\n\n=== PROJECT KNOWLEDGE ===\n" +
      PROJECT_KNOWLEDGE +
      "\n\n=== OWNER DATA ===\n" +
      lines.join("\n");

    const input = [
      ...history.map((m) => ({
        role: m.role,
        content: [{ type: m.role === "user" ? "input_text" : "output_text", text: m.text }],
      })),
      {
        role: "user" as const,
        content: [
          ...scans.map((s) => ({
            type: "input_file" as const,
            filename: s.filename,
            file_data: `data:application/pdf;base64,${s.data}`,
          })),
          { type: "input_text" as const, text: data.question },
        ],
      },
    ];

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions: system,
        input,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
      }),
    });

    if (!res.ok || !res.body) {
      const status = res.status;
      if (status === 429) throw new Error("AI assistant is busy, please try again in a moment");
      if (status === 402) throw new Error("AI credits exhausted");
      throw new Error(`AI assistant unavailable (${status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let answer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const event = JSON.parse(payload) as {
              type?: string;
              delta?: string;
              response?: { output_text?: string };
            };
            if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
              answer += event.delta;
            } else if (event.type === "response.completed" && !answer) {
              answer = event.response?.output_text ?? "";
            }
          } catch {
            // Ignore keep-alive and non-JSON frames.
          }
        }
      }
    }

    const finalAnswer = answer.trim();

    // Persist both sides of the exchange; a storage failure must not lose the answer.
    try {
      await context.supabase.from("chat_messages").insert([
        { owner_id: context.userId, role: "user", content: data.question },
        { owner_id: context.userId, role: "assistant", content: finalAnswer, sources },
      ]);
    } catch {
      // History saving is best-effort.
    }

    return { answer: finalAnswer, sources, empty: false as const };
  });

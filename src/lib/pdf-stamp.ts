import { formatDate } from "./format";
import type { Lang } from "./i18n";

/**
 * Fetch a PDF, overlay a diagonal "PAID" stamp on the first page, and return
 * the stamped PDF as a Blob. Used for paid ROI reports so the downloaded file
 * itself shows its payment status.
 */
export async function stampPaidPdf(
  url: string,
  paidLabel: string,
  paidAt?: string | null,
  lang: Lang = "en",
): Promise<Blob> {
  const { PDFDocument, rgb, degrees, StandardFonts } = await import("pdf-lib");

  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch PDF");

  const bytes = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "";
  // Not a PDF (e.g. xlsx statement): hand back the original file untouched.
  if (contentType && !contentType.includes("pdf") && !/\.pdf(\?|$)/i.test(url)) {
    return new Blob([bytes], { type: contentType });
  }

  let pdf: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdf = await PDFDocument.load(bytes);
  } catch {
    return new Blob([bytes], { type: contentType || "application/pdf" });
  }
  const pages = pdf.getPages();
  if (pages.length === 0) return new Blob([bytes], { type: "application/pdf" });


  const page = pages[0]!;
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Standard PDF fonts only cover WinAnsi; fall back for non-Latin labels.
  const raw = paidLabel.toUpperCase();
  const stamp = /^[\x20-\xFF]+$/.test(raw) ? raw : "PAID";
  const size = Math.min(72, (width * 0.75) / (font.widthOfTextAtSize(stamp, 72) / 72));
  const stampWidth = font.widthOfTextAtSize(stamp, size);

  const angle = -35;
  const rad = (angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = width / 2;
  const cy = height / 2;
  // Rotation happens around the text anchor, so offset the anchor by the
  // rotated half-extent to keep the stamp visually centred on the page.
  const anchor = (w: number, h: number, dy = 0) => ({
    x: cx - (w / 2) * cos - (h / 2 + dy) * -sin,
    y: cy - (w / 2) * sin - (h / 2 + dy) * cos,
  });

  const stampAnchor = anchor(stampWidth, size * 0.7);
  page.drawText(stamp, {
    ...stampAnchor,
    size,
    font,
    color: rgb(0.15, 0.55, 0.32),
    rotate: degrees(angle),
    opacity: 0.35,
  });

  if (paidAt) {
    const dateText = `Paid on ${formatDate(paidAt, lang)}`;
    const dateSize = 14;
    const dateWidth = font.widthOfTextAtSize(dateText, dateSize);
    const dateAnchor = anchor(dateWidth, dateSize * 0.7, size * 0.95);
    page.drawText(dateText, {
      ...dateAnchor,
      size: dateSize,
      font,
      color: rgb(0.15, 0.55, 0.32),
      rotate: degrees(angle),
      opacity: 0.6,
    });
  }


  const stamped = await pdf.save();
  return new Blob([stamped.buffer as ArrayBuffer], { type: "application/pdf" });
}

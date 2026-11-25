import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, ExternalLink, FileText, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

type Kind = "pdf" | "image" | "office" | "text" | "other";

const OFFICE = ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "rtf"];

function kindFrom(name: string): Kind {
  const ext = name.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/)?.[1] ?? "";
  if (ext === "pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "avif", "heic"].includes(ext)) return "image";
  if (OFFICE.includes(ext)) return "office";
  if (["txt", "csv", "md"].includes(ext)) return "text";
  return "other";
}

function officeEmbed(url: string) {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

/**
 * Mobile browsers (iOS Safari, Android Chrome) cannot render a PDF inside an
 * iframe: the frame stays blank. Detect the built-in viewer and fall back to a
 * clear open/download card instead of showing an empty sheet.
 */
function canRenderPdfInline() {
  if (typeof navigator === "undefined") return true;
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}


/**
 * Document preview. The signed URL is fetched lazily (prefetched on hover, so a
 * click opens instantly) and the viewer is rendered in a portal on <body> to
 * escape row transforms/stacking contexts.
 */
export function DocPreview({
  id,
  title,
  subtitle,
  fileName,
  getUrl,
  onDownload,
  stampPaid = false,
  paidAt = null,
  as: Tag = "div",
  className,
  style,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string | undefined;
  fileName?: string | undefined;
  getUrl: (id: string) => Promise<string>;
  onDownload?: (id: string) => void;
  /** Overlay a diagonal PAID stamp on the previewed PDF (payment receipts). */
  stampPaid?: boolean;
  paidAt?: string | null;
  as?: "div" | "li";
  className?: string;
  style?: React.CSSProperties;
  children: (openPreview: () => void) => React.ReactNode;
}) {
  const { t } = useI18n();
  const [url, setUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cache = useRef<string | null>(null);

  const kind = kindFrom(fileName ?? url ?? title);
  const pdfInline = kind !== "pdf" || canRenderPdfInline();

  const blobUrl = useRef<string | null>(null);

  const load = useCallback(async () => {
    if (cache.current) {
      setUrl(cache.current);
      return;
    }
    try {
      let next = await getUrl(id);
      if (stampPaid) {
        try {
          const { stampPaidPdf } = await import("@/lib/pdf-stamp");
          const stamped = await stampPaidPdf(next, "PAID", paidAt, "en");
          blobUrl.current = URL.createObjectURL(stamped);
          next = blobUrl.current;
        } catch {
          // Stamping is cosmetic: fall back to the original file.
        }
      } else if (kindFrom(fileName ?? title) === "pdf") {
        const response = await fetch(next);
        if (!response.ok) throw new Error("File unavailable");
        const total = Number(response.headers.get("content-length") ?? 0);
        let blob: Blob;
        if (total > 0 && response.body) {
          const reader = response.body.getReader();
          const chunks: Uint8Array[] = [];
          let received = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.byteLength;
              setProgress(Math.min(99, Math.round((received / total) * 100)));
            }
          }
          blob = new Blob(chunks as BlobPart[], { type: "application/pdf" });
        } else {
          blob = new Blob([await response.arrayBuffer()], { type: "application/pdf" });
        }
        setProgress(100);
        blobUrl.current = URL.createObjectURL(blob);
        next = blobUrl.current;
      }
      cache.current = next;
      setUrl(next);
    } catch {
      setFailed(true);
    }
  }, [fileName, getUrl, id, stampPaid, paidAt, title]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [expanded]);

  function enter() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void load(), 280);
  }

  function leave() {
    if (timer.current) clearTimeout(timer.current);
  }

  const viewer = expanded ? (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-plum/75 p-0 backdrop-blur-sm sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => setExpanded(false)}
    >
      <div
        className="flex h-full w-full flex-col overflow-hidden border-hairline bg-background shadow-2xl sm:h-[92vh] sm:max-w-5xl sm:rounded-2xl sm:border"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-4 border-b border-hairline px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0">
            <p className="truncate text-[15px] leading-6">{title}</p>
            {subtitle ? (
              <p className="mt-0.5 truncate text-xs leading-5 text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {url && !url.startsWith("blob:") ? (
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                aria-label={t("doc.previewOpenTab")}
                title={t("doc.previewOpenTab")}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-cream/60 hover:text-violet"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
            {onDownload ? (
              <button
                type="button"
                onClick={() => onDownload(id)}
                aria-label={t("doc.download")}
                title={t("doc.download")}
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-cream/60 hover:text-violet"
              >
                <Download className="h-4 w-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-label={t("doc.previewClose")}
              title={t("doc.previewClose")}
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-cream/60 hover:text-violet"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center overflow-auto bg-cream/40">
          {failed ? (
            <p className="px-6 py-10 text-sm text-muted-foreground">{t("doc.unavailable")}</p>
          ) : !url ? (
            <div className="relative h-full w-full animate-pulse bg-cream/70">
              {progress > 0 ? (
                <span className="absolute inset-x-0 top-1/2 text-center text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                  {progress}%
                </span>
              ) : null}
            </div>
          ) : kind === "image" ? (
            <img src={url} alt={title} className="max-h-full max-w-full object-contain" />
          ) : kind === "pdf" && pdfInline ? (
            <iframe src={`${url}#view=FitH`} title={title} className="h-full w-full border-0" />
          ) : kind === "office" ? (
            <iframe
              src={officeEmbed(url)}
              title={title}
              className="h-full w-full border-0 bg-background"
            />
          ) : kind === "text" ? (
            <iframe src={url} title={title} className="h-full w-full border-0 bg-background" />
          ) : (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full border border-hairline bg-background">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </span>
              <p className="mt-5 max-w-sm text-sm leading-6 text-muted-foreground">
                {t("doc.previewNoInline")}
              </p>
              <div className="mt-5 flex items-center gap-5">
                {url.startsWith("blob:") ? (
                  <a
                    href={url}
                    download={fileName ?? title}
                    className="text-[11px] tracking-[0.12em] text-violet uppercase"
                  >
                    {t("doc.download")}
                  </a>
                ) : (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] tracking-[0.12em] text-violet uppercase"
                  >
                    {t("doc.previewOpenTab")}
                  </a>
                )}
                {onDownload ? (
                  <button
                    type="button"
                    onClick={() => onDownload(id)}
                    className="text-[11px] tracking-[0.12em] text-muted-foreground uppercase transition-colors hover:text-violet"
                  >
                    {t("doc.download")}
                  </button>
                ) : null}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  ) : null;

  return (
    <Tag className={className} style={style} onMouseEnter={enter} onMouseLeave={leave}>
      {children(() => {
        setExpanded(true);
        void load();
      })}
      {viewer && typeof document !== "undefined" ? createPortal(viewer, document.body) : null}
    </Tag>
  );
}

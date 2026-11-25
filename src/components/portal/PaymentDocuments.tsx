import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Eye, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { getPaymentDocUrl } from "@/lib/files.functions";
import { DocPreview } from "@/components/portal/DocPreview";

type PaymentDoc = {
  id: string;
  owner_id: string;
  uploader_id: string;
  from_admin: boolean;
  title: string;
  file_path: string;
  created_at: string;
};

function formatDate(value: string, lang: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(lang === "ru" ? "ru-RU" : "en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
}

/**
 * Per-owner payment details: bank details uploaded by the owner and payment
 * confirmations uploaded by the management company. Both sides can upload,
 * preview and download; owners can only delete their own uploads.
 */
export function PaymentDocuments({
  ownerId,
  adminView = false,
}: {
  ownerId: string;
  /** True when rendered inside the admin owners screen. */
  adminView?: boolean;
}) {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const queryKey = ["payment-documents", ownerId];
  const { data: docs } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_documents")
        .select("*")
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaymentDoc[];
    },
  });

  async function getUrl(id: string) {
    const { url } = await getPaymentDocUrl({ data: { id } });
    return url;
  }

  async function download(doc: PaymentDoc) {
    try {
      const url = await getUrl(doc.id);
      const response = await fetch(url);
      if (!response.ok) throw new Error("File unavailable");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = doc.title || "file";
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error(t("doc.unavailable"));
    }
  }

  async function upload(file: File) {
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${ownerId}/${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("payment-details")
        .upload(path, file, file.type ? { contentType: file.type } : {});
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("payment_documents").insert({
        owner_id: ownerId,
        uploader_id: auth.user.id,
        from_admin: adminView,
        title: file.name,
        file_path: path,
      });
      if (insertError) {
        await supabase.storage.from("payment-details").remove([path]);
        throw insertError;
      }
      await queryClient.invalidateQueries({ queryKey });
      toast.success(t("paydocs.uploaded"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(doc: PaymentDoc) {
    setDeleting(doc.id);
    try {
      const { error } = await supabase.from("payment_documents").delete().eq("id", doc.id);
      if (error) throw error;
      await supabase.storage.from("payment-details").remove([doc.file_path]);
      await queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("common.error"));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted-foreground">{t("paydocs.hint")}</p>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-2 border border-violet px-3 py-1.5 text-[11px] tracking-[0.14em] text-violet uppercase transition-colors hover:bg-violet hover:text-primary-foreground disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? t("paydocs.uploading") : t("paydocs.upload")}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>

      {!docs || docs.length === 0 ? (
        <p className="border-t border-hairline pt-4 text-sm text-muted-foreground">
          {t("paydocs.empty")}
        </p>
      ) : (
        <ul>
          {docs.map((doc) => (
            <DocPreview
              key={doc.id}
              as="li"
              id={doc.id}
              title={doc.title}
              fileName={doc.title}
              getUrl={getUrl}
              onDownload={() => void download(doc)}
              className="flex items-center gap-3 border-t border-hairline py-3"
            >
              {(openPreview) => (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{doc.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {doc.from_admin ? t("paydocs.fromAdmin") : t("paydocs.fromOwner")}
                      {" · "}
                      {formatDate(doc.created_at, lang)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={openPreview}
                      aria-label={t("doc.preview")}
                      title={t("doc.preview")}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-cream/60 hover:text-violet"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void download(doc)}
                      aria-label={t("doc.download")}
                      title={t("doc.download")}
                      className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-cream/60 hover:text-violet"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    {adminView || !doc.from_admin ? (
                      <button
                        type="button"
                        disabled={deleting === doc.id}
                        onClick={() => void remove(doc)}
                        aria-label={t("paydocs.delete")}
                        title={t("paydocs.delete")}
                        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-cream/60 hover:text-rose disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </DocPreview>
          ))}
        </ul>
      )}
    </div>
  );
}

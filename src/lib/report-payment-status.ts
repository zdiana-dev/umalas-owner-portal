export type ReportPaymentStatus = "paid" | "unpaid" | "no_roi";

export function paymentStatusUpdate(status: ReportPaymentStatus, report: { report_type: string; net_payout: number | null }, now: string) {
  if (status === "no_roi" && (report.report_type !== "roi" || report.net_payout !== 0)) {
    throw new Error("No ROI payment is only available for zero-payout ROI reports");
  }
  return { is_paid: status === "paid", paid_at: status === "paid" ? now : null, no_roi_payment: status === "no_roi" };
}
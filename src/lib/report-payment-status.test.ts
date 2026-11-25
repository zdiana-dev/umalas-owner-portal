import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { paymentStatusUpdate } from "./report-payment-status";

describe("No ROI payment", () => {
  test("is separate from paid and has no payment date", () => {
    assert.deepEqual(paymentStatusUpdate("no_roi", { report_type: "roi", net_payout: 0 }, "2026-11-14"), { is_paid: false, paid_at: null, no_roi_payment: true });
  });
  test("cannot hide a nonzero payout", () => {
    assert.throws(() => paymentStatusUpdate("no_roi", { report_type: "roi", net_payout: 5018966 }, "2026-11-14"));
  });
  test("paid clears the no-payment status", () => {
    assert.deepEqual(paymentStatusUpdate("paid", { report_type: "roi", net_payout: 0 }, "2026-11-14"), { is_paid: true, paid_at: "2026-11-14", no_roi_payment: false });
  });
});
/** Labels used on owner statements for the final payable amount, most specific first. */
const LABELS = [
  "amount to be paid",
  "amount to be transferred",
  "net payout",
  "total payout",
  "amount payable",
  "сумма к выплате",
  "к выплате",
];

/** Pulls the payable amount out of extracted statement text. */
export function parsePayout(text: string): number | null {
  const flat = text.replace(/\s+/g, " ");
  const lower = flat.toLowerCase();
  for (const label of LABELS) {
    let from = 0;
    let best: number | null = null;
    for (;;) {
      const at = lower.indexOf(label, from);
      if (at === -1) break;
      from = at + label.length;
      const window = flat.slice(from, from + 80);
      const dash = window.match(/^[:\s]*(?:[A-Z]{3})?\s*[-–—](?=\s|$)/);
      if (dash) {
        best = 0;
        continue;
      }
      const match = window.match(/[\d][\d.,\s]*\d|\d/);
      if (match) {
        const digits = match[0].replace(/[^\d]/g, "");
        if (digits) best = Number(digits);
      }
    }
    if (best !== null) return best;
  }
  return null;
}
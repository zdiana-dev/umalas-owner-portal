// Mirrors published payment-plan payouts into the connected LUXSO Google Calendar.
// Unpaid items (shown as «В обработке») become all-day events; paid items are removed.
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_calendar/calendar/v3";
const CALENDAR_ID = "primary";

function headers() {
  const lovable = process.env["LOVABLE_API_KEY"];
  const cal = process.env["GOOGLE_CALENDAR_API_KEY"];
  if (!lovable || !cal) throw new Error("Google Calendar is not connected");
  return { Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": cal, "Content-Type": "application/json" };
}

const eventId = (itemId: string) => `umalas${itemId.replace(/-/g, "")}`;

function nextDay(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export async function syncPayoutCalendar() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: items, error } = await supabaseAdmin
    .from("payment_plan_items")
    .select("id, paid_at, payment_plans!inner(status, plan_date, name), reports!inner(id, due_date, net_payout, currency, period_label, is_paid, paid_at, units!inner(code, projects(name)))")
    .in("payment_plans.status", ["published", "completed"]);
  if (error) throw new Error(error.message);
  const h = headers();
  let added = 0, removed = 0;
  for (const item of (items ?? []) as any[]) {
    const report = item.reports;
    const id = eventId(item.id);
    const url = `${GATEWAY_URL}/calendars/${CALENDAR_ID}/events`;
    const paid = Boolean(item.paid_at || report.is_paid);
    const paidSrc = report.paid_at ?? item.paid_at;
    const paidDate = paidSrc ? String(paidSrc).slice(0, 10) : null;
    const date = report.due_date ?? item.payment_plans.plan_date;
    const amount = report.net_payout != null ? `${Number(report.net_payout).toLocaleString("ru-RU")} ${report.currency}` : "";
    const body = {
      id,
      status: "confirmed",
      colorId: paid ? "10" : "5", // green when paid, amber while in progress
      summary: `${paid ? `✓ Оплачено / PAID${paidDate ? ` ${paidDate}` : ""}` : "В обработке"} · ${report.units.code} · ${amount}`.trim(),
      description: `${report.units.projects?.name ?? ""}\nПериод: ${report.period_label}\nПлан выплат: ${item.payment_plans.name}\n${
        paid ? `Оплачено / Paid${paidDate ? `: ${paidDate}` : ""}.` : "Выплата в течение 2 дней."
      }`,
      start: { date: paid && paidDate ? paidDate : date },
      end: { date: nextDay(paid && paidDate ? paidDate : date) },
    };
    if (paid) removed++;
    let res = await fetch(`${url}/${id}`, { method: "PUT", headers: h, body: JSON.stringify(body) });
    if (res.status === 404) res = await fetch(url, { method: "POST", headers: h, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(`Calendar update failed [${res.status}]: ${await res.text()}`);
    added++;
  }
  return { added, removed };
}

export async function trySyncPayoutCalendar() {
  try { await syncPayoutCalendar(); } catch (e) { console.error("Payout calendar sync failed", e); }
}

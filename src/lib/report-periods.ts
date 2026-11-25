export const REPORT_PERIODS = [
  { label: "Apr–June 2026", start: "2026-04-01", end: "2026-06-30" },
  { label: "July 2026", start: "2026-07-01", end: "2026-07-31" },
  { label: "August 2026", start: "2026-08-01", end: "2026-08-31" },
  { label: "September 2026", start: "2026-09-01", end: "2026-09-30" },
  { label: "June–August 2026", start: "2026-06-01", end: "2026-08-31" },
  { label: "July–September 2026", start: "2026-07-01", end: "2026-09-30" },
  { label: "October 2026", start: "2026-10-01", end: "2026-10-31" },
  { label: "September–November 2026", start: "2026-09-01", end: "2026-11-30" },
  { label: "November 2026", start: "2026-11-01", end: "2026-11-30" },
  { label: "December 2026", start: "2026-12-01", end: "2026-12-31" },
  { label: "October–December 2026", start: "2026-10-01", end: "2026-12-31" },
] as const;

export const DEFAULT_REPORT_PERIOD = REPORT_PERIODS[3];
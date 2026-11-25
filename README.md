# Umalas Owner's Vault

Build "Owner Portal — The Umalas Signature": a private owner cabinet for a Bali villa/apartment rental-pool management company (Magnum Estate). About 175 units in the rental pool, each owned by one or more investors. An owner logs in and sees ONLY their own units, their documents and their monthly ROI reports.

VISUAL DESIGN
Calm, premium, minimal — this must feel like a private bank statement, not a startup SaaS dashboard. Warm off-white background (#FAF8F5), deep charcoal text (#1F1D1A), one muted gold accent (#B08D57), thin hairline dividers, generous whitespace, no bright colors, no gradients, no emoji. Serif display headings (Playfair Display) with a clean sans body (Inter). Numbers are the hero: large, tabular figures. Fully responsive and mobile-first — most owners will open this on a phone. Support light theme only for now.

BACKEND
Supabase: email/password + magic-link auth, private storage buckets for files, and strict row-level security. Files must never be served from public URLs — always short-lived signed URLs.

DATA MODEL
- profiles (user_id, full_name, email, phone, preferred_language 'ru'|'en', role 'owner'|'admin')
- units (id, code e.g. "US-A-201", building, unit_type, bedrooms, area_sqm, purchase_price_usd, purchase_date, handover_date, status)
- ownerships (owner_id -> profiles, unit_id -> units, share_percent, start_date, end_date nullable) — many-to-many: one owner can hold several units, one unit can have co-owners, and access ends when end_date passes
- documents (id, unit_id nullable, owner_id nullable, category enum: contract | certificate | act | invoice | tax | other, title, file_path, issued_date, is_published)
- monthly_reports (id, unit_id, period date = first day of month, gross_revenue, occupancy_percent, adr, management_fee, operating_expenses, other_deductions, net_payout, currency, pdf_path nullable, status 'draft'|'published', published_at)
- payouts (id, unit_id, owner_id, period, amount, paid_at, method, reference, proof_path)
- audit_log (id, actor_id, action, entity, entity_id, created_at)

SECURITY — this is the most important part of the app
- An owner can SELECT a unit, document, monthly_report or payout only if a row in `ownerships` links their user_id to that unit_id, the ownership is still active (end_date is null or in the future), AND the record is published (documents.is_published = true, monthly_reports.status = 'published').
- Owners have no INSERT / UPDATE / DELETE rights anywhere.
- Users with role = 'admin' have full access.
- Enforce all of this with Postgres row-level security policies, not just in the frontend.
- Storage buckets are private; downloads go through signed URLs generated only after the same ownership check.

OWNER PAGES
1. Login — branded, with a RU/EN toggle. Russian is the default language.
2. Dashboard — portfolio summary: total invested, total received to date, cumulative ROI %, annualised net yield %, a payback progress bar, last month's net payout, a 24-month bar chart of net payout, and one card per owned unit.
3. Unit page — hero photo, key facts, and tabs: Reports / Documents / Payouts.
4. Reports — a month-by-month table (gross revenue, occupancy %, ADR, management fee, expenses, net payout) with a chart above it, expandable rows, and a PDF download per month.
5. Documents — grouped by category, searchable, with in-browser preview and download.
6. Profile — name, contacts, interface language, change password.

ADMIN PAGES (role = 'admin')
- Owners list, Units list, and an ownership assignment screen.
- Bulk import of monthly reports from XLSX/CSV: upload one file with a row per unit (columns: unit_code, period, gross_revenue, occupancy_percent, adr, management_fee, operating_expenses, other_deductions, net_payout, currency) -> a validation preview screen listing errors, duplicates and unmatched unit codes -> confirm -> rows are created with status 'draft'.
- A "Publish period" action that publishes every report for a chosen month at once and writes to the audit log.
- Bulk document upload: drag and drop many files at once, auto-match each file to a unit by filename prefix (e.g. "US-A-201_contract_2024.pdf" -> unit US-A-201, category contract), with a manual fix-up screen for files that did not match.
- Audit log viewer.

I18N
Every UI string goes through an i18n layer with Russian and English dictionaries. Russian is the default. Money is always formatted with thousands separators and an explicit currency label.

SEED DATA
Seed 3 demo owners, 6 demo units, 18 months of realistic demo monthly reports and a few placeholder documents, so the dashboard looks real immediately.

Start with the owner-facing experience and the security model; the admin bulk-import screens can come right after.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://umalas-owner.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5efeedec-59c2-40c3-9644-5b3e04bd835e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitLab and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

# Owner dashboard

## Goal
Create one signed-in dashboard for every owner, whether they have one unit or several. It will summarize the information already available in the portal and provide direct paths to the full screens.

## What will change
- Add a **Dashboard** page as the first page after sign-in.
- Show all linked units, with each unit opening its detailed page.
- Show an **Upcoming payments** summary grouped safely by currency, with the nearest payment dates and a link to Reports.
- Show recently published documents with unit labels and a link to Documents.
- Add a **Send me a new password link** action that sends only to the signed-in owner’s verified account email, with clear success, cooldown, and error states.
- Add a public password-reset page where the owner can set and confirm a new password after opening the email link.
- Update the portal navigation and sign-in redirects so owners land on Dashboard; keep existing Unit, Documents, Reports, Messages, Profile, and Admin pages available.
- Add Russian and English labels and messages matching the current language switch.

## Technical details
- Reuse the existing owner-scoped unit, report, document, and profile queries; database access rules continue to limit each owner to their own records.
- Treat unpaid published ROI reports as upcoming payments. Display totals separately per currency and never combine unlike currencies.
- Use the existing design tokens, typography, loading states, and compact responsive layout.
- Request reset email through the existing authentication service with a redirect to `/reset-password`; never expose or generate a temporary password.
- The reset page will validate the recovery session and update the password only after matching, minimum-length confirmation.

## Validation
- Verify dashboard rendering and navigation for one-unit and four-unit owners at desktop and 375px widths.
- Verify empty states for no upcoming payments and no documents.
- Verify the password-link request feedback and the recovery page UI.
- Confirm the latest app build reports no errors.

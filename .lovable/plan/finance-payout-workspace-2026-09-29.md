# Finance payout workspace

## What will be built

- Add dedicated **Finance** and **Luxso management** staff roles, separate from owners and administrators.
- Add a **Payment plans** area for administrators inside ROI Payouts.
- Let an administrator select unpaid ROI reports, arrange their priority, name/date the plan, and publish it to finance.
- Add a restricted **Finance workspace** showing:
  - all ROI payouts and their status;
  - today’s published payment plan first, in priority order;
  - villa, project, owner, period, amount, and currency.
- Let finance staff mark a queued payout paid in one click. The payment date will automatically use the current date.
- Immediately update the same ROI report everywhere, including the owner dashboard, owner reports, payout calendar, and admin ROI list.
- Keep finance staff away from owner documents, owner profile editing, invitations, villa editing, and other admin controls.
- Add administrator controls to invite staff, assign project access, and revoke access.
- Add project-limited Luxso access for two verified accounts:
  - `tus-owners@luxsomanagement.com`: Umalas ROI payment status and uploaded reports only.
  - `fc@luxsomanagement.com`: Sky Stars ROI payment status and uploaded reports only.
- Let each Luxso user open and read every report within their assigned project, without access to other projects or owner administration.

## Workflow

```text
Admin selects unpaid ROI reports
            ↓
Admin orders priorities and publishes today’s plan
            ↓
Finance sees the queue plus all payout history
            ↓
Finance clicks “Mark paid”
            ↓
Payment status and date update everywhere
```

## Security and data

- Store staff roles and project assignments in separate protected tables rather than on owner profiles.
- Store payment plans and ordered plan items separately from ROI reports.
- Only administrators can create, reorder, publish, or cancel plans and manage finance access.
- Finance users can read ROI payout information and payment plans, but can only change a queued payout from unpaid to paid.
- Luxso management users have read-only report and payment-status access, restricted to their assigned project. Access is granted only after their email is verified.
- Owners retain access only to reports belonging to their own villas.
- Every change will record who marked the payout paid and when.

## Interface details

- **Admin ROI Payouts:** selectable unpaid rows, “Create payment plan,” ordering controls, draft/published plan status.
- **Finance workspace:** priority queue at the top, filters for project/status/date, and full payout history below.
- **Luxso workspace:** project-branded, read-only report list with villa, period, amount, paid status, payment date, and report viewer.
- **Owner dashboard:** continues using the Paid ROI section already added; it updates automatically after finance confirms payment.
- Russian and English labels will be included.

## Verification

- Verify an administrator can create and publish a plan.
- Verify a finance account can see all payouts and the ordered queue, but cannot open admin-only owner or villa tools.
- Verify one-click payment records today’s date and updates the relevant owner’s Paid ROI section.
- Verify an owner cannot access the finance workspace or alter payout status.
- Verify each Luxso account sees only its assigned project and cannot alter payment status or open owner/admin tools.

<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep report-period presets in `src/lib/report-periods.ts` so every admin upload form uses identical labels and dates.
- Store no-ROI settlement separately from payment, restricted to zero-payout ROI reports; it must never imply a bank transfer or a paid date.
- Render a project's own mark in the portal header; use the Umalas mark only for Umalas so project brands never mix.
- Keep `/sky-stars` as the branded Sky Stars owner login; Sky Stars owners should see its cover and mark, never Umalas branding.
- Keep `/anoya` as the branded Anoya owner login; Anoya owners should see its cover and mark without Umalas or management branding.
- Store staff permissions in `user_roles` and project scope in `staff_project_access`; profile roles remain owner/admin for legacy owner flows and cannot authorize staff access.
- Finance may complete only payouts in a published payment plan; this keeps admin priority decisions as the approval boundary.
- Luxso staff access is read-only and project-scoped: `tus-owners@luxsomanagement.com` is Umalas and `fc@luxsomanagement.com` is Sky Stars.

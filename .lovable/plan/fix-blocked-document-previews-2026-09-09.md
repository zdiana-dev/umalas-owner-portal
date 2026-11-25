# Fix blocked document previews

## What will change
- Load PDF files into the portal before displaying them, instead of embedding the private storage link directly.
- Show the PDF from a temporary browser URL so Chrome cannot block the embedded preview.
- Keep the existing open-in-new-tab and download actions unchanged.
- Preserve the existing paid-stamp behavior for paid ROI files.

## Validation
- Open BG11 documents in the admin unit page and confirm the PDF renders inside the preview.
- Confirm closing/reopening previews works and temporary file URLs are cleaned up.
- Check the latest app build status and browser errors.

## Technical details
- Update only the shared document preview component; all owner and admin document/report previews inherit the fix.

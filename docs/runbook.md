# Runbook — Lead Tracking & Listing Alert Automation

## Deployment Checklist

1. Create a Gmail search query that matches Zillow / StreetEasy alert emails (sender addresses for StreetEasy and Zillow).
2. Build the Zap: Gmail "New Email Matching Search" trigger (polls every 15 min) → Code by Zapier JavaScript step → Google Sheets Create Row → Google Sheets Update Row.
3. Write the JavaScript parsing step: regex extraction of address, rent, broker, phone, email, and URL from the subject and body. Normalize everything to the sheet schema in the README.
4. Create the destination Google Sheet with the columns documented in the README mapping table.
5. Send test emails and verify each field lands in the correct column before going live.
6. Install dedup on the tracker sheet (sheet-side, not a Zap step): open the sheet → Extensions → Apps Script → paste `dedup.gs` → save → run `deduplicateTrackerDryRun()` once to preview what would be removed → run `deduplicateTracker()` once to clean existing repeats → run `installDedupTrigger()` once so new rows are deduped automatically. A lookup step inside Zapier (match on listing ID, update the existing row, otherwise add a row) with real status values remains unbuilt — it needs a paid Zapier plan. Do not document it as live until it is wired in.

## Maintenance

- **Email layout changes:** If Zillow/StreetEasy redesign their alert emails, the JavaScript parsing may break. Update the extraction logic (regex) against fresh samples.
- **Sheet schema changes:** If you add or rename columns, update the field mapping in the Zap — mapping drift after a sheet edit is the most common silent failure.
- **Repeat rows:** The Zap has no dedup step, so repeat alerts create repeat rows when they land. `dedup.gs` removes them on the sheet once installed (see the deployment checklist). Until it is installed, clean repeats manually.
- **Zap status:** The Zap is currently paused (trial expired). Re-enabling needs a paid Zapier plan, since the JavaScript step is a paid feature.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Fields arriving blank | Email layout changed; JS extraction no longer matches | Update the parsing logic against a recent email |
| Duplicate rows | Expected if `dedup.gs` is not installed on the sheet | Install `dedup.gs` (see the deployment checklist); removed rows are copied to the "Dedup Log" sheet first. If it is installed and duplicates remain, check the trigger was installed (run `installDedupTrigger()` once) and that the addresses are not blank or "undisclosed" — those are never deleted |
| Status column not set | Update step misconfigured | Check the update step targets the row ID returned by the create step |
| Workflow not firing | Gmail search query too narrow, or Zap paused | Broaden the query; check trigger history and Zap status |

## Failure Modes Considered

- Parser returns partial data → row is still logged with available fields (empty strings / N/A defaults); better incomplete than dropped.
- Email delayed by provider → the trigger polls every 15 min; a delay only delays, never drops.

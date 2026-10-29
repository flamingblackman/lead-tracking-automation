# Runbook — Lead Tracking & Listing Alert Automation

## Deployment Checklist

1. Create a Gmail search query that matches Zillow / StreetEasy alert emails (sender addresses for StreetEasy and Zillow).
2. Build the Zap: Gmail "New Email Matching Search" trigger (polls every 15 min) → Code by Zapier JavaScript step → Google Sheets Create Row → Google Sheets Update Row.
3. Write the JavaScript parsing step: regex extraction of address, rent, broker, phone, email, and URL from the subject and body. Normalize everything to the sheet schema in the README.
4. Create the destination Google Sheet with the columns documented in the README mapping table.
5. Send test emails and verify each field lands in the correct column before going live.
6. Planned, not built: a lookup step (match on listing ID, update the existing row, otherwise add a row) with real status values. Do not document it as live until it is wired in.

## Maintenance

- **Email layout changes:** If Zillow/StreetEasy redesign their alert emails, the JavaScript parsing may break. Update the extraction logic (regex) against fresh samples.
- **Sheet schema changes:** If you add or rename columns, update the field mapping in the Zap — mapping drift after a sheet edit is the most common silent failure.
- **Repeat rows:** The live build has no dedup, so repeat alerts create repeat rows. Clean them periodically until the lookup step is built.
- **Zap status:** The Zap is currently paused (trial expired). Re-enabling needs a paid Zapier plan, since the JavaScript step is a paid feature.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Fields arriving blank | Email layout changed; JS extraction no longer matches | Update the parsing logic against a recent email |
| Duplicate rows | Expected: no dedup step in the live build | Clean repeats manually; build the planned lookup step |
| Status column not set | Update step misconfigured | Check the update step targets the row ID returned by the create step |
| Workflow not firing | Gmail search query too narrow, or Zap paused | Broaden the query; check trigger history and Zap status |

## Failure Modes Considered

- Parser returns partial data → row is still logged with available fields (empty strings / N/A defaults); better incomplete than dropped.
- Email delayed by provider → the trigger polls every 15 min; a delay only delays, never drops.

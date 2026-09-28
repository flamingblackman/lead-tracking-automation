# Runbook — Lead Tracking & Listing Alert Automation

## Deployment Checklist

1. Create a Gmail search query that matches Zillow / StreetEasy alert emails (e.g. `from:(zillow OR streeteasy) subject:(listing OR alert)` — tune to your actual senders).
2. Build the Zap: Gmail "New Email Matching Search" trigger → Code by Zapier JavaScript step → Google Sheets.
3. Write the JavaScript parsing step: extract address, price, beds, baths, URL, contact info, and status from the email body/HTML. Normalize everything to the sheet schema in the README.
4. Create the destination Google Sheet with the columns documented in the README mapping table. Keep `listing_id` as the dedup key.
5. Add the Sheets logic: look up `listing_id` → match found = update row, no match = add row.
6. Send test emails and verify each field lands in the correct column before going live.

## Maintenance

- **Email layout changes:** If Zillow/StreetEasy redesign their alert emails, the JavaScript parsing may break. Update the extraction logic (selectors/regex) against fresh samples.
- **Sheet schema changes:** If you add or rename columns, update the field mapping in the Zap — mapping drift after a sheet edit is the most common silent failure.
- **Archiving:** Move `off_market` rows to an archive sheet monthly to keep the working sheet fast.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Fields arriving blank | Email layout changed; JS extraction no longer matches | Update the parsing logic against a recent email |
| Duplicate rows | Dedup lookup failing (listing ID format changed) | Verify the lookup key matches the sheet's `listing_id` format |
| Rows not updating | Lookup step misconfigured | Check the find-row step returns the correct row before update |
| Workflow not firing | Gmail search query too narrow | Broaden the query; check Zapier's trigger history |

## Failure Modes Considered

- Parser returns partial data → row is still logged with available fields; better incomplete than dropped.
- Email delayed by provider → the pipeline is event-driven; a delay only delays, never drops.

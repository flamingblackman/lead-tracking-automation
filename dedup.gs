/**
 * dedup.gs — sheet-side dedup for the lead-tracking pipeline.
 *
 * Why this exists: the Zapier Zap appends one row per listing email and has
 * no lookup step, so repeat alerts for the same listing create repeat rows.
 * A lookup step inside Zapier needs a paid Zapier plan (the Zap is paused
 * since the trial expired), so dedup lives here instead, in the sheet.
 * The Zap is untouched. This script only cleans up rows after they land.
 *
 * How it works:
 * - Key is the Property Address, normalized: lowercase, punctuation stripped,
 *   whitespace collapsed. "809 MIDWOOD STREET #5A" and
 *   "809 Midwood Street #5A" are the same listing. "#5A" and "#4A" are not:
 *   the unit number is part of the key, so different units at the same
 *   building stay separate rows.
 * - First row seen for an address is kept. Every later row with the same
 *   normalized address is deleted, and a copy is written to a "Dedup Log"
 *   sheet first, so nothing is silently lost.
 * - Rows with a blank address, or an address that says "undisclosed", are
 *   never deleted — those cannot be told apart, so deleting one could
 *   delete a different listing.
 *
 * Install (do once, in the tracker sheet):
 * 1. Open the tracker Google Sheet. Extensions > Apps Script.
 * 2. Delete the default Code.gs contents, paste this file, save.
 * 3. Run deduplicateTrackerDryRun() once from the editor and check the log:
 *    it lists what would be removed without deleting anything.
 * 4. Run deduplicateTracker() once to clean the existing repeats.
 * 5. Run installDedupTrigger() once so new rows are deduped automatically
 *    whenever the Zap (or anything else) appends rows. The first run of any
 *    function asks you to authorize the script — that is normal.
 *
 * The script adds a "Lead Tracker" menu to the sheet with "Remove duplicate
 * listings" and "Dry run: show duplicates", so it can also be run by hand.
 */

var ADDRESS_HEADER = 'Property Address';
var LOG_SHEET_NAME = 'Dedup Log';

/** Normalize an address into a dedup key. */
function normalizeAddress_(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9#]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '');
}

/** True when an address cannot be used as a dedup key. */
function isUndistinguishable_(normalized) {
  return !normalized || normalized.indexOf('undisclosed') !== -1;
}

/** Find the tracker sheet: the sheet whose header row has Property Address. */
function findTrackerSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var headers = sheets[i].getRange(1, 1, 1, sheets[i].getLastColumn()).getValues()[0];
    for (var c = 0; c < headers.length; c++) {
      if (String(headers[c]).trim().toLowerCase() === ADDRESS_HEADER.toLowerCase()) {
        return { sheet: sheets[i], addressCol: c + 1 };
      }
    }
  }
  throw new Error('No sheet with a "' + ADDRESS_HEADER + '" header found.');
}

/** Get the Dedup Log sheet, creating it with headers if it does not exist. */
function getLogSheet_(ss) {
  var log = ss.getSheetByName(LOG_SHEET_NAME);
  if (!log) {
    log = ss.insertSheet(LOG_SHEET_NAME);
    log.appendRow(['Removed at', 'Original row', 'Date Contacted', 'Property Address', 'Rent Amount', 'Source', 'Reason']);
  }
  return log;
}

/**
 * Remove later duplicate rows, keeping the first row per address.
 * Pass true for a dry run: reports what would be removed, deletes nothing.
 * Returns { removed: number, rows: [ {row, address} ] }.
 */
function deduplicateTracker(dryRun) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var found = findTrackerSheet_(ss);
  var sheet = found.sheet;
  var addressCol = found.addressCol;

  var lastRow = sheet.getLastRow();
  if (lastRow < 3) {
    Logger.log('Nothing to dedup: fewer than 2 data rows.');
    return { removed: 0, rows: [] };
  }

  var values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  var seen = {};
  var dupes = []; // { row: sheet row number, values: row values, address: normalized }

  for (var i = 0; i < values.length; i++) {
    var normalized = normalizeAddress_(values[i][addressCol - 1]);
    if (isUndistinguishable_(normalized)) continue;
    if (seen[normalized]) {
      dupes.push({ row: i + 2, values: values[i], address: normalized });
    } else {
      seen[normalized] = i + 2;
    }
  }

  if (!dupes.length) {
    Logger.log('No duplicate addresses found.');
    return { removed: 0, rows: [] };
  }

  if (dryRun) {
    Logger.log('Dry run: would remove ' + dupes.length + ' row(s): ' +
      dupes.map(function (d) { return 'row ' + d.row + ' (' + d.values[addressCol - 1] + ')'; }).join('; '));
    return { removed: dupes.length, rows: dupes.map(function (d) { return { row: d.row, address: d.values[addressCol - 1] }; }) };
  }

  var log = getLogSheet_(ss);
  var now = new Date();
  dupes.forEach(function (d) {
    log.appendRow([now, d.row, d.values[0], d.values[addressCol - 1], d.values[2], d.values[3], 'Duplicate address, first row kept']);
  });

  // Delete bottom-up so earlier row numbers stay valid.
  dupes.map(function (d) { return d.row; }).sort(function (a, b) { return b - a; })
    .forEach(function (r) { sheet.deleteRow(r); });

  Logger.log('Removed ' + dupes.length + ' duplicate row(s). Copies kept in "' + LOG_SHEET_NAME + '".');
  return { removed: dupes.length, rows: dupes.map(function (d) { return { row: d.row, address: d.values[addressCol - 1] }; }) };
}

/** Dry run: list the duplicates without deleting anything. */
function deduplicateTrackerDryRun() {
  return deduplicateTracker(true);
}

/** Install an on-change trigger so new rows are deduped automatically. */
function installDedupTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'onDedupChange') {
      Logger.log('Dedup trigger already installed.');
      return;
    }
  }
  ScriptApp.newTrigger('onDedupChange').forSpreadsheet(ss).onChange().create();
  Logger.log('Dedup trigger installed. New rows will be deduped automatically.');
}

/** Trigger handler: dedup whenever rows are added (e.g. the Zap appends). */
function onDedupChange(e) {
  try {
    if (e && e.changeType === 'INSERT_ROW') {
      deduplicateTracker(false);
    }
  } catch (err) {
    Logger.log('Dedup on change failed: ' + err.message);
  }
}

/** Add a "Lead Tracker" menu to the sheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Lead Tracker')
    .addItem('Remove duplicate listings', 'deduplicateTracker')
    .addItem('Dry run: show duplicates', 'deduplicateTrackerDryRun')
    .addToUi();
}

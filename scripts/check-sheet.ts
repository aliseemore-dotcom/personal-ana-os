/**
 * Prints how the Data Hub's sheets map onto Personal OS, so column names can be checked
 * before anything is deployed. Shows structure only (names and counts), never cell values.
 *
 *   npm run sheets:check        (reads .env.local)
 */
import { createGoogleSheetsClient, googleConfigFromEnv } from '../server/sheets/client.js';
import { readRecords, SHEETS } from '../server/sheets/schema.js';
import { parseTable } from '../server/sheets/table.js';

const cfg = googleConfigFromEnv(process.env);
const client = createGoogleSheetsClient({ ...cfg, write: false });
const names = Object.values(SHEETS).map((s) => s.sheet);

try {
  const grids = await client.readSheets(names);
  let problems = 0;
  for (const spec of Object.values(SHEETS)) {
    const table = parseTable(grids[spec.sheet]);
    const { diagnostics: d } = readRecords(table, spec);
    const ok = d.idColumnFound && d.missingColumns.length === 0;
    if (!ok) problems++;
    console.log(`\n${ok ? '✓' : '!'} ${spec.sheet}: ${d.rowsRead} rows, id column "${spec.idColumn}" ${d.idColumnFound ? 'found' : 'MISSING'}`);
    if (d.missingColumns.length) console.log(`    not in the sheet (will be empty / not written): ${d.missingColumns.join(', ')}`);
    if (d.unmappedColumns.length) console.log(`    extra columns (kept, not used by the UI): ${d.unmappedColumns.join(', ')}`);
    if (d.rowsWithoutId) console.log(`    ${d.rowsWithoutId} row(s) have no ${spec.idColumn} and are skipped`);
  }
  console.log(problems ? `\n${problems} sheet(s) need a look. Column names are matched by name; nothing is renamed by the app.` : '\nAll sheets match.');
} catch (e) {
  console.error('Could not read the Data Hub:', (e as Error).message);
  process.exit(1);
}

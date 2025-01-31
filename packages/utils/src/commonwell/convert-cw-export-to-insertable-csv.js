/* eslint-disable no-undef */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
/**
 * Script to convert a CareQuality CSV export to a format that can be inserted into the database.
 *
 * Run with `node convert-cw-export-to-insertable-csv.js` to generate a new file.
 * 
 * You need to update the file paths in the file manually
 */

const BATCH_SIZE = 1000; // Number of records per INSERT statement

function parseCSVLine(line) {
  const result = [];
  let inQuotes = false;
  let currentValue = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      result.push(currentValue);
      currentValue = '';
      continue;
    }

    currentValue += char;
  }

  result.push(currentValue);
  return result.map(val => val.trim());
}

function escapeSQL(str) {
  if (!str) return null;
  return str.replace(/'/g, "''").trim();
}

function convertCsvToSQL(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const originalHeaders = parseCSVLine(lines[0]);

  const desiredColumns = {
    'Organization Name': 'organization_name',
    'Organization ID': 'organization_id',
    'Status': 'status',
    'Org Type': 'org_type',
    'Member Name': 'member_name',
    'Address 1': 'address_line1',
    'Address 2': 'address_line2',
    'City': 'city',
    'State': 'state',
    'Zip Code': 'zip_code',
    'Country': 'country'
  };

  const columnIndices = Object.keys(desiredColumns).map(header =>
    originalHeaders.indexOf(header)
  );

  const headerSQL = `INSERT INTO cw_directory_entry (
    ${Object.values(desiredColumns).join(',\n    ')}
  )\nVALUES\n`;

  let sqlStatements = [];
  let currentBatch = [];

  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const selectedValues = columnIndices.map(index => {
      const value = values[index];
      return value ? `'${escapeSQL(value)}'` : 'NULL';
    });

    currentBatch.push(`(${selectedValues.join(', ')})`);

    if (currentBatch.length === BATCH_SIZE || i === lines.length - 1) {
      sqlStatements.push(headerSQL + currentBatch.join(',\n') + ';');
      currentBatch = [];
    }
  }

  return sqlStatements.join('\n\n');
}

const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const outputFilename = `cw-export_${year}-${month}-${day}.sql`;

const csvText = fs.readFileSync('cw-export.csv', 'utf8');
const sqlContent = convertCsvToSQL(csvText);

fs.writeFileSync(outputFilename, sqlContent);
console.log(`Conversion complete! Check ${outputFilename}`);

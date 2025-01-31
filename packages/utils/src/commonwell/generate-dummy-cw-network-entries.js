/* eslint-disable no-undef */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { faker } = require('@faker-js/faker');
/**
 * Script to generate fake CommonWell organization data in CSV or SQL format.
 *
 * Run with:
 * - CSV: `node convert-cw-export-to-insert-stmts.js csv`
 * - SQL: `node convert-cw-export-to-insert-stmts.js sql`
 */

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

function convertCsvWithSelectedColumns(csvText) {
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

  const newRows = lines.map((line, lineIndex) => {
    if (lineIndex === 0) {
      return Object.values(desiredColumns)
        .map(header => `"${header}"`)
        .join(',');
    }

    const values = parseCSVLine(line);
    const selectedValues = columnIndices.map(index => {
      const value = values[index] || '';
      return `"${value}"`;
    });

    return selectedValues.join(',');
  });

  return newRows.join('\n');
}

const usedOrgIds = new Set();

function generateUniqueOrgId() {
  let id;
  do {
    id = `2.16.840.1.${faker.number.int({ min: 1000000, max: 9999999 })}.${faker.number.int({ min: 1000000, max: 9999999 })}`;
  } while (usedOrgIds.has(id));
  usedOrgIds.add(id);
  return id;
}

function generateFakeOrganization() {
  return {
    organization_name: `[TEST] ${faker.company.name()}`,
    organization_id: generateUniqueOrgId(),
    status: faker.helpers.arrayElement(['Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Inactive']),
    org_type: faker.helpers.arrayElement(['HOSPITAL', 'CLINIC', 'PRACTICE']),
    member_name: faker.company.name(),
    address_line1: faker.location.streetAddress(),
    address_line2: faker.location.secondaryAddress(),
    city: faker.location.city(),
    state: faker.location.state({ abbreviated: true }),
    zip_code: faker.location.zipCode(),
    country: 'US'
  };
}

function generateCsvContent(numRecords = 100) {
  const headers = [
    'organization_name',
    'organization_id',
    'status',
    'org_type',
    'member_name',
    'address_line1',
    'address_line2',
    'city',
    'state',
    'zip_code',
    'country'
  ];

  const headerRow = headers.map(h => `"${h}"`).join(',');
  const rows = Array.from({ length: numRecords }, () => {
    const org = generateFakeOrganization();
    const values = headers.map(h => `"${org[h]}"`).join(',');
    return values;
  });

  return [headerRow, ...rows].join('\n');
}

function generateSqlContent(numRecords = 100) {
  const TABLE_NAME = 'cw_directory_entry';
  const headers = [
    'organization_name',
    'organization_id',
    'status',
    'org_type',
    'member_name',
    'address_line1',
    'address_line2',
    'city',
    'state',
    'zip_code',
    'country'
  ];

  const insertLines = Array.from({ length: numRecords }, () => {
    const org = generateFakeOrganization();
    const values = headers.map(h => {
      const value = org[h];
      return value === '' ? 'NULL' : `'${value.replace(/'/g, "''")}'`;
    });
    return `INSERT INTO ${TABLE_NAME} (${headers.join(', ')}) VALUES (${values.join(', ')});`;
  });

  return insertLines.join('\n');
}

function generateOutput(format = 'csv', numRecords = 30000) {
  const today = new Date();
  const isoDate = today.toISOString().split('T')[0];
  const extension = format === 'sql' ? 'sql' : 'csv';
  const outputFilename = `${isoDate}_cw-entries-dummy-insert.${extension}`;

  const content = format === 'sql'
    ? generateSqlContent(numRecords)
    : generateCsvContent(numRecords);

  fs.writeFileSync(outputFilename, content);
  console.log(`Generated ${outputFilename} with fake CommonWell organization data`);

  if (format === 'csv') {
    const headers = content.split('\n')[0];
    console.log('\nPostgreSQL-style headers:');
    console.log(headers);
  }
}

// Get format from command line argument
const format = process.argv[2]?.toLowerCase();
if (!['csv', 'sql'].includes(format)) {
  console.error('Invalid format. Use "csv" or "sql"');
  process.exit(1);
}

generateOutput(format);

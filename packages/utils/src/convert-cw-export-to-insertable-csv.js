/* eslint-disable no-undef */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');

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

const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const outputFilename = `cw-export_${year}-${month}-${day}.csv`;

const csvText = fs.readFileSync('cw-export.csv', 'utf8');
const newCsvContent = convertCsvWithSelectedColumns(csvText);

fs.writeFileSync(outputFilename, newCsvContent);
console.log(`Conversion complete! Check ${outputFilename}`);

const newHeaders = newCsvContent.split('\n')[0];
console.log('\nNew PostgreSQL-style headers:');
console.log(newHeaders);

const fs = require('fs');

function convertCsvToJson(csvText) {
  // Split into lines and get headers
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/["]/g, '').trim());

  // Process data lines
  return lines.slice(1).map((line, index) => {
    // Split by comma, but respect quoted values
    const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g)
      .map(val => val.replace(/["]/g, '').trim());

    // Create object with desired schema
    return {
      id: index + 1,
      organizationName: values[headers.indexOf('Organization Name')] || '',
      organizationId: values[headers.indexOf('Organization ID')] || '',
      status: values[headers.indexOf('Status')] || '',
      orgType: values[headers.indexOf('Org Type')] || '',
      memberName: values[headers.indexOf('Member Name')] || '',
      addressLine1: values[headers.indexOf('Address 1')] || '',
      addressLine2: values[headers.indexOf('Address 2')] || '',
      city: values[headers.indexOf('City')] || '',
      state: values[headers.indexOf('State')] || '',
      zipCode: values[headers.indexOf('Zip Code')] || '',
      country: values[headers.indexOf('Country')] || ''
    };
  });
}

// Read input file
const csvText = fs.readFileSync('cw-export.csv', 'utf8');
const jsonObjects = convertCsvToJson(csvText);


// Generate filename with current date
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0');
const day = String(today.getDate()).padStart(2, '0');
const outputFilename = `cw-export_${year}-${month}-${day}.json`;

// Write output file
fs.writeFileSync(outputFilename, JSON.stringify(jsonObjects, null, 2));
console.log(`Conversion complete! Check ${outputFilename}`);

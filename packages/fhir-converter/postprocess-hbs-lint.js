const fs = require('fs');
const path = require('path');

const inputFilePath = path.join('lint-results.txt');
const errorsToFilter = [
  "Handlebars partials are not supported",
  "Changing context using \"../\" is not supported in Glimmer"
];

fs.readFile(inputFilePath, 'utf8', (err, data) => {
  if (err) {
    console.error(err);
    return;
  }

  const lines = data.split('\n');
  let resultLines = [];
  let skipUntilIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (i <= skipUntilIndex) {
      continue;
    }

    const containsFilteredError = errorsToFilter.some(error => lines[i].includes(error));
    if (containsFilteredError) {
      if (i > 0 && !resultLines.includes(lines[i - 1])) {
        resultLines.pop();
      }
      skipUntilIndex = i + 7;
    } else {
      resultLines.push(lines[i]);
    }
  }

  // Second round of filtering
  resultLines = resultLines.filter((line, index, array) => {
    // Check if both the current line and the next line look like file paths
    const isCurrentLineFilePath = line.includes('/');
    const isNextLineFilePath = array[index + 1] && array[index + 1].includes('/');
    return !(isCurrentLineFilePath && isNextLineFilePath);
  });

  // Remove the last two lines from the filtered data
  resultLines = resultLines.slice(0, -3);

  const filteredData = resultLines.join('\n');
  console.log(filteredData);
});
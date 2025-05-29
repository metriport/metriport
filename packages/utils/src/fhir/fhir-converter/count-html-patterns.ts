/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from "fs";
import readline from "readline";

// This script is a helper to understand the html sections within resources

interface TableStructure {
  table: {
    thead: { tr: { th: { _: string }[] | { _: string } } };
    tbody: { tr: any[] | any }; // Use 'any' to accommodate varied content within 'td'
  };
}

interface TD {
  _: string;
  paragraph?: Paragraph[] | Paragraph;
  [key: string]: any; // Additional properties, like styleCode
}

interface Paragraph {
  content: { _: string }[] | { _: string };
  [key: string]: any; // Additional properties, like styleCode
}

interface ContentFootnoteStructure {
  content: {
    _: string;
    ID: string;
  };
  footnote: {
    _: string;
    ID: string;
    styleCode: string;
  };
}

async function countMatchingPatterns(filePath: string): Promise<{
  tableCount: number;
  contentFootnoteCount: number;
  simpleCount: number;
  paragraphCount: number;
  contentCount: number;
}> {
  let tableCount = 0;
  let contentFootnoteCount = 0;
  let simpleCount = 0;
  let paragraphCount = 0;
  let contentCount = 0;

  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const json = JSON.parse(line);
    if (checkTablePattern(json)) {
      extractAndMapTableData(json);
      tableCount++;
    } else if (checkContentFootnotePattern(json)) {
      contentFootnoteCount++;
    } else if (checkSimplePattern(json)) {
      simpleCount++;
    } else if (checkParagraphPattern(json)) {
      paragraphCount++;
    } else if (checkContentPattern(json)) {
      contentCount++;
    } else {
      console.log(json);
    }
  }

  return { tableCount, contentFootnoteCount, simpleCount, paragraphCount, contentCount };
}

function checkContentFootnotePattern(json: ContentFootnoteStructure): boolean {
  try {
    // Check for the existence of content and footnote
    if (!json.content || !json.footnote) return false;

    // Check for specific nested properties within content and footnote
    if (!("_" in json.content) || !("ID" in json.content)) return false;
    if (!("_" in json.footnote) || !("ID" in json.footnote) || !("styleCode" in json.footnote))
      return false;

    // Add any additional checks here if needed
  } catch (error) {
    // If any key is missing or structure is incorrect, return false
    return false;
  }

  return true;
}

function checkSimplePattern(json: any): boolean {
  return "_" in json && Object.keys(json).length === 1;
}

function checkParagraphPattern(json: any): boolean {
  if (!("paragraph" in json)) return false;
  if (!("_" in json.paragraph)) return false;
  return true;
}

function checkContentPattern(json: any): boolean {
  return (
    "content" in json &&
    "_" in json.content &&
    "ID" in json.content &&
    Object.keys(json.content).length === 2
  );
}

function checkTablePattern(json: TableStructure): boolean {
  try {
    // Check for the existence of thead.tr
    if (!json.table.thead.tr) return false;

    // Check tbody.tr, which could be an array or a single object
    const tbodyTrs =
      json.table.tbody.tr instanceof Array ? json.table.tbody.tr : [json.table.tbody.tr];

    // Ensure every tr contains a td
    for (const tr of tbodyTrs) {
      if (!("td" in tr)) return false;
      // If td is required to be checked further (e.g., for arrays of tds), add additional checks here
    }
  } catch (error) {
    // If any key is missing or structure is incorrect, return false
    return false;
  }

  return true;
}

function extractAndMapTableData(json: TableStructure): any[] {
  const headers = Array.isArray(json.table.thead.tr.th)
    ? json.table.thead.tr.th.map((th: { _: string }) => th._)
    : [json.table.thead.tr.th._];

  const trArray = Array.isArray(json.table.tbody.tr) ? json.table.tbody.tr : [json.table.tbody.tr];

  const mappedData = trArray.map((tr: any) => {
    const tdArray = Array.isArray(tr.td) ? tr.td : [tr.td];

    const rowData: { [key: string]: string } = {}; // Define the object with an index signature
    tdArray.forEach((td: TD, index: number) => {
      if (td.paragraph) {
        const paragraphArray = Array.isArray(td.paragraph) ? td.paragraph : [td.paragraph];
        const textValues = paragraphArray
          .map((paragraph: Paragraph) => {
            const contentArray = Array.isArray(paragraph.content)
              ? paragraph.content
              : [paragraph.content];
            return concatenateTextValues(contentArray);
          })
          .join("\n");
        rowData[headers[index]] = textValues;
      } else {
        rowData[headers[index]] = td._;
      }
    });
    return rowData;
  });

  console.log(JSON.stringify(mappedData, null, 2));
  return mappedData;
}

function concatenateTextValues(content: { _: string }[] | { _: string } | undefined): string {
  if (!content) {
    // If content is undefined, return an empty string
    return "";
  }
  // Ensure content is treated as an array
  const contentArray = Array.isArray(content) ? content : [content];
  // Filter out any undefined items and concatenate "_" field values
  return contentArray
    .filter(item => item && "_ in item")
    .map((item: { _: string }) => item._)
    .join("\n");
}

// Use process.argv to get the file path from the command line arguments
const filePath = process.argv[2];
if (!filePath) {
  console.error("Please provide a file path as an argument.");
  process.exit(1);
}

countMatchingPatterns(filePath)
  .then(({ tableCount, contentFootnoteCount, simpleCount, paragraphCount, contentCount }) => {
    console.log(`Number of JSON objects matching the table pattern: ${tableCount}`);
    console.log(
      `Number of JSON objects matching the content-footnote pattern: ${contentFootnoteCount}`
    );
    console.log(`Number of JSON objects matching the simple pattern: ${simpleCount}`);
    console.log(`Number of JSON objects matching the paragraph pattern: ${paragraphCount}`);
    console.log(`Number of JSON objects matching the content pattern: ${contentCount}`);
  })
  .catch(error => {
    console.error("Error counting matching patterns:", error);
  });

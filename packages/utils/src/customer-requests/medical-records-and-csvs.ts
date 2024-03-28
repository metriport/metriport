import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import fs from "fs";
import { convertHtmlTablesToCsv } from "./convert-html-to-csv";
import * as path from "path";

// Function to process each JSON file
function processFile(filePath: string) {
  const bundle = fs.readFileSync(filePath, "utf8");
  const bundleParsed = JSON.parse(bundle);

  // Convert JSON to HTML
  const html = bundleToHtml(bundleParsed);
  const htmlOutputFilePath = filePath.replace(".json", ".html");
  fs.writeFileSync(htmlOutputFilePath, html);
  console.log(`HTML file created at ${htmlOutputFilePath}`);

  // Convert HTML to CSV
  const csvContent = convertHtmlTablesToCsv(html);
  const csvOutputFilePath = filePath.replace(".json", ".csv");
  fs.writeFileSync(csvOutputFilePath, csvContent);
  console.log(`CSV file created at ${csvOutputFilePath}`);
}

// Main function to iterate through the directory
function main() {
  const targetPath = process.argv[2];

  if (!targetPath) {
    console.log("Usage: node medical-records-local.js <path-to-directory>");
    process.exit(1);
  }

  const files = fs.readdirSync(targetPath);
  files.forEach(file => {
    const fullPath = path.join(targetPath, file);
    if (path.extname(fullPath) === ".json") {
      processFile(fullPath);
    }
  });
}

main();

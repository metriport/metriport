import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import fs from "fs";

if (process.argv.length < 3) {
  console.log("Usage: node medical-records-local.js <path-to-json-file>");
  process.exit(1);
}

const filePath = process.argv[2];
const bundle = fs.readFileSync(filePath, "utf8");
const bundleParsed = JSON.parse(bundle);

const html = bundleToHtml(bundleParsed);

const outputFilePath = filePath.replace(".json", ".html");

fs.writeFileSync(outputFilePath, html);
console.log(`HTML file created at ${outputFilePath}`);

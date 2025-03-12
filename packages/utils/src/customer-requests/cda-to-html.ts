/* eslint-disable */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { cleanUpPayload } from "@metriport/core/domain/conversion/cleanup";
import { wkHtmlToPdf, WkOptions } from "@metriport/core/external/wk-html-to-pdf/index";
import { sleep } from "@metriport/shared";
import fs from "fs";
import { Readable } from "stream";
import { convertToHtml } from "../../../lambdas/src/cda-to-visualization";
import { elapsedTimeAsStr } from "../shared/duration";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const styleSheetText = require("../../../lambdas/src/cda-to-visualization/stylesheet.js");

/**
 * Script to convert a CDA bundle to HTML and PDF.
 *
 * To generate PDFs, it requires `wkhtmltopdf` to be installed in the system.
 * See https://wkhtmltopdf.org/downloads.html
 * You can skip the PDF generation by setting `SKIP_PDF` to `true`.
 *
 * To use it:
 * 1. Set the variables:
 *  - SOURCE_BUNDLE_FILE: the full path to the CDA/XML file
 *  - SKIP_PDF: if true, it will skip the PDF generation
 * 2. Run the script with:
 *  - `npm run cda-to-html`
 */

const SOURCE_BUNDLE_FILE = ``;
const SKIP_PDF = false;

const pdfOptions: WkOptions = {
  orientation: "Portrait",
  pageSize: "A4",
};

let cda10: unknown;
let narrative: unknown;
const styleSheetTextStringified = JSON.stringify(styleSheetText);

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const bundleStr = fs.readFileSync(SOURCE_BUNDLE_FILE, { encoding: "utf8" });

  // Trying to keep the same logic from the lambda - it won't be needed once we move the lambda's
  // main logic to core, then we can import it here too.
  const document = cleanUpPayload(bundleStr);

  console.log(`Converting to HTML...`);
  const htmlStartedAt = Date.now();
  const html = await convertToHtml(document, {}, console.log);
  const htmlDuration = Date.now() - htmlStartedAt;
  fs.writeFileSync(`${SOURCE_BUNDLE_FILE}_output.html`, html);

  if (!SKIP_PDF) {
    console.log(`Converting to PDF...`);
    const pdfStartedAt = Date.now();
    const stream = Readable.from(Buffer.from(html));
    const pdfData = await wkHtmlToPdf(pdfOptions, stream, console.log);
    const pdfDuration = Date.now() - pdfStartedAt;
    fs.writeFileSync(`${SOURCE_BUNDLE_FILE}_output.pdf`, pdfData);
    console.log(
      `>>> Done in ${elapsedTimeAsStr(
        startedAt
      )}, HTML in ${htmlDuration}ms, PDF in ${pdfDuration}ms`
    );
  } else {
    console.log(
      `>>> Done in ${elapsedTimeAsStr(startedAt)}, HTML in ${htmlDuration}ms, PDF skipped`
    );
  }
}

main();

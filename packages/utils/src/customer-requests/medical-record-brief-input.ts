/* eslint-disable */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import { Brief } from "@metriport/core/command/ai-brief/create";
import { getAiBriefContentFromBundle } from "@metriport/core/command/ai-brief/shared";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { BundleToHtmlOptions } from "@metriport/core/external/aws/lambda-logic/bundle-to-html-shared";
import { wkHtmlToPdf, WkOptions } from "@metriport/core/external/wk-html-to-pdf/index";
import { sleep } from "@metriport/shared";
import fs from "fs";
import { Readable } from "stream";
import { elapsedTimeAsStr } from "../shared/duration";
import { uuidv7 } from "../shared/uuid-v7";

/**
 * Script to trigger MR Summary generation on a FHIR payload locally, with the AI Brief included in it.
 *
 * To generate PDFs, it requires `wkhtmltopdf` to be installed in the system.
 * See https://wkhtmltopdf.org/downloads.html
 * You can skip the PDF generation by setting `SKIP_PDF` to `true`.
 *
 * To use it:
 * 1. Set the variables:
 *  - SOURCE_BUNDLE_FILE: the full path to the consolidated (FHIR) bundle file
 *  - SKIP_PDF: if true, it will skip the PDF generation
 * 2. Run the script with:
 *  - `ts-node src/customer-requests/medical-record-brief-input`
 */

// Update this to staging or local URL if you want to test the brief link
const dashURL = "http://dash.metriport.com";

const SOURCE_BUNDLE_FILE = ``;
const SKIP_PDF = false;

// TODO 2510 When we move the lambda logic to core, we can remove this
// Copied from fhir-to-medical-record-new.ts
const htmlOptions: BundleToHtmlOptions = {
  customCssHeaderTables: `{
    display: -webkit-box; /* wkhtmltopdf uses this one */
    display: -webkit-flex;
    display: flex;
    -webkit-box-flex: 1;
    -webkit-flex: 1;
    flex: 1;
    -webkit-align-self: flex-end;
    align-self: flex-end;
    -webkit-box-pack: center; /* wkhtmltopdf uses this one */
    -webkit-justify-content: center;
    justify-content: center;
  }`,
};
const pdfOptions: WkOptions = {
  orientation: "Portrait",
  pageSize: "A4",
};

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const bundleStr = fs.readFileSync(SOURCE_BUNDLE_FILE, { encoding: "utf8" });
  const bundle = JSON.parse(bundleStr) as Bundle<Resource>;

  const aiBriefContent = getAiBriefContentFromBundle(bundle);
  const aiBrief = prepareBriefToBundle({ aiBrief: aiBriefContent });

  console.log(`Converting to HTML...`);
  const htmlStartedAt = Date.now();
  const html = bundleToHtml(bundle, aiBrief, htmlOptions);
  const htmlDuration = Date.now() - htmlStartedAt;
  fs.writeFileSync(`${SOURCE_BUNDLE_FILE}_output.html`, html);
  console.log(`Converting to PDF...`);
  const pdfStartedAt = Date.now();

  if (!SKIP_PDF) {
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

// Copied from fhir-to-medical-record.ts
function prepareBriefToBundle({ aiBrief }: { aiBrief: string | undefined }): Brief | undefined {
  if (!aiBrief) return undefined;
  const feedbackId = uuidv7();
  const feedbackLink = `${dashURL}/feedback/${feedbackId}`;
  return {
    id: feedbackId,
    content: aiBrief,
    link: feedbackLink,
  };
}

main();

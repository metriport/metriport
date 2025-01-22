/* eslint-disable */
// @ts-nocheck
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import { summarizeFilteredBundleWithAI } from "@metriport/core/command/ai-brief/create";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { wkHtmlToPdf, WkOptions } from "@metriport/core/external/wk-html-to-pdf/index";
import { sleep } from "@metriport/shared";
import fs from "fs";
import { Readable } from "stream";
import { elapsedTimeAsStr } from "../shared/duration";
import { uuidv7 } from "../shared/uuid-v7";

/**
 * Script to trigger MR Summary generation on a FHIR payload locally, with the AI Brief included in it.
 *
 * To use it:
 * 1. Set the variables:
 *  - SOURCE_DIR: the directory where the FHIR bundle is located
 *  - CX_ID: the customer ID
 *  - SOURCE_PATIENT_ID: the patient ID
 *  - SOURCE_BUNDLE_FILE: the name of the FHIR bundle file
 * 2. Run the script with:
 *  - `ts-node src/customer-requests/medical-record-brief-input.ts`
 */

// Update this to staging or local URL if you want to test the brief link
const dashUrl = "http://dash.metriport.com";

const SOURCE_DIR = "";
const CX_ID = ""; // OPTIONAL - used for logs and analytics in the summarizeFilteredBundleWithAI function
const SOURCE_PATIENT_ID = "";
const SOURCE_BUNDLE_FILE = `${SOURCE_PATIENT_ID}.json`;

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const fileName = `${SOURCE_DIR}/${SOURCE_BUNDLE_FILE}`;
  const bundleStr = fs.readFileSync(fileName, { encoding: "utf8" });
  const bundle = JSON.parse(bundleStr) as Bundle<Resource>;

  const briefStartedAt = Date.now();
  const brief = await summarizeFilteredBundleWithAI(bundle, CX_ID, SOURCE_PATIENT_ID);
  const briefDuration = Date.now() - briefStartedAt;
  const briefId = uuidv7();

  console.log(`Converting to HTML...`);
  const htmlStartedAt = Date.now();
  const html = bundleToHtml(
    bundle,
    brief ? { content: brief, id: briefId, link: `${dashUrl}/feedback/${briefId}` } : undefined
  );
  fs.writeFileSync(`${SOURCE_DIR}/output_${SOURCE_BUNDLE_FILE}.html`, html);
  const htmlDuration = Date.now() - htmlStartedAt;
  console.log(`Converting to PDF...`);
  const pdfStartedAt = Date.now();
  const options: WkOptions = {
    orientation: "Landscape",
    pageSize: "A3",
  };
  const stream = Readable.from(Buffer.from(html));
  const pdfData = await wkHtmlToPdf(options, stream, console.log);
  fs.writeFileSync(`${SOURCE_DIR}/output_${SOURCE_BUNDLE_FILE}.pdf`, pdfData);
  const pdfDuration = Date.now() - pdfStartedAt;

  console.log(
    `>>> Done in ${elapsedTimeAsStr(
      startedAt
    )}, Brief in ${briefDuration}ms, HTML in ${htmlDuration}ms, PDF in ${pdfDuration}ms`
  );
}

main();

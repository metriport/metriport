/* eslint-disable */
// @ts-nocheck
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { Bundle, Resource } from "@medplum/fhirtypes";
import { summarizeFilteredBundleWithAI } from "@metriport/core/external/aws/lambda-logic/bundle-to-brief";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import fs from "fs";
import { uuidv7 } from "../shared/uuid-v7";

/**
 * Script to trigger MR Summary generation on a FHIR payload locally, with the AI Brief included in it.
 */

// Update this to staging or local URL if you want to test the brief link
const dashUrl = "http://dash.metriport.com";

const SOURCE_DIR = "";
const CX_ID = ""; // OPTIONAL - used for logs and analytics in the summarizeFilteredBundleWithAI function
const SOURCE_PATIENT_ID = "";
const SOURCE_BUNDLE_FILE = `${SOURCE_PATIENT_ID}.json`;

async function main() {
  const fileName = `${SOURCE_DIR}/${SOURCE_BUNDLE_FILE}`;
  const bundleStr = fs.readFileSync(fileName, { encoding: "utf8" });
  const bundle = JSON.parse(bundleStr) as Bundle<Resource>;

  const brief = await summarizeFilteredBundleWithAI(bundle, CX_ID, SOURCE_PATIENT_ID);
  const briefId = uuidv7();

  const html = bundleToHtml(
    bundle,
    brief ? { content: brief, id: briefId, link: `${dashUrl}/feedback/${briefId}` } : undefined
  );

  fs.writeFileSync(`${SOURCE_DIR}/output_${SOURCE_BUNDLE_FILE}.html`, html);
}

main();

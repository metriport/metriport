/* eslint-disable */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { sleep } from "@metriport/shared";
import fs from "fs";
import path from "path";
import SaxonJS from "saxon-js";
import { elapsedTimeAsStr } from "../shared/duration";
import { cleanUpPayload } from "@metriport/core/domain/conversion/cleanup";

// eslint-disable-next-line @typescript-eslint/no-var-requires
// Need to run from the utils directory to have a stable working directory
const UTILS_DIR = process.cwd();
const styleSheetText = require(path.join(
  UTILS_DIR,
  "../lambdas/src/cda-to-visualization/stylesheet.js"
));

/**
 * Script to convert a CDA document to HTML.
 *
 * To use it:
 * 1. Set the variables:
 *  - SOURCE_FILE: the full path to the CDA/XML file
 * 2. Run the script with:
 *  - `npm run cda-to-html`
 */

const SOURCE_FILE = ``;

let cda10: unknown;
let narrative: unknown;
const styleSheetTextStringified = JSON.stringify(styleSheetText);

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const document = fs.readFileSync(SOURCE_FILE, { encoding: "utf8" });

  // Clean up the document according to the standard normalization process
  const normalizedDocument = cleanUpPayload(document);

  console.log(`Converting to HTML...`);
  const htmlStartedAt = Date.now();
  const html = await convertToHtml(normalizedDocument, console.log);
  const htmlDuration = Date.now() - htmlStartedAt;
  fs.writeFileSync(`${SOURCE_FILE}_output.html`, html);

  console.log(`>>> Done in ${elapsedTimeAsStr(startedAt)}, HTML in ${htmlDuration}ms`);
}

// TODO #2619 Move this to core and point the lambda to it too
// Based on packages/lambdas/src/cda-to-visualization.ts
async function convertToHtml(document: string, log: typeof console.log): Promise<string> {
  const cda10 = await getCda10();
  const narrative = await getNarrative();

  const result = await SaxonJS.transform(
    {
      stylesheetText: styleSheetTextStringified,
      stylesheetParams: {
        vocFile: cda10,
        narrative: narrative,
      },
      sourceText: document,
      destination: "serialized",
    },
    "async"
  );

  return result.principalResult.toString();
}
// Copied from packages/lambdas/src/cda-to-visualization.ts
async function getCda10() {
  if (!cda10) {
    cda10 = await SaxonJS.getResource(
      {
        location:
          "https://raw.githubusercontent.com/metriport/metriport/master/packages/lambdas/static/cda_l10n.xml",
        type: "xml",
      },
      "async"
    );
  }
  return cda10;
}
// Copied from packages/lambdas/src/cda-to-visualization.ts
async function getNarrative() {
  if (!narrative) {
    narrative = await SaxonJS.getResource(
      {
        location:
          "https://raw.githubusercontent.com/metriport/metriport/master/packages/lambdas/static/cda_narrativeblock.xml",
        type: "xml",
      },
      "async"
    );
  }
  return narrative;
}

main();

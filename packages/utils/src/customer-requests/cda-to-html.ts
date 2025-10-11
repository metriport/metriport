/* eslint-disable */
import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { cleanUpPayload } from "@metriport/core/domain/conversion/cleanup";
import { sleep } from "@metriport/shared";
import { Command } from "commander";
import fs from "fs";
import path from "path";
import SaxonJS from "saxon-js";
import { elapsedTimeAsStr } from "../shared/duration";

/**
 * IMPORTANT: to run this script, uncomment the "ts-node" section of the packages/utils/tsconfig.json file.
 * Don't commit the change - it makes ts-node slower/heavier (but cda-to-html works).
 *
 * This script converts a CDA document to HTML. Pass an absolute or relative path to the CDA/XML file
 * as an argument - if it is a relative path, it must be relative to the utils directory.
 *
 * Usage:
 * > npm run cda-to-html -- runs/cda-to-html/example-cda.xml
 * > npm run cda-to-html -- /Users/user/Documents/example-cda.xml
 *
 * In the example above, the output HTML will be written to the same directory as "example-cda.html".
 */
const program = new Command();
program.name("cda-to-html");
program.description("CLI to test conversion of a CDA document to HTML");
program.argument("<source-file>", "The path to the CDA/XML file");
program.showHelpAfterError();
program.action(convertCdaToHtml);

const styleSheetText = require(path.join(
  __dirname,
  "../../../lambdas/src/cda-to-visualization/stylesheet.js"
));

let cda10: unknown;
let narrative: unknown;
const styleSheetTextStringified = JSON.stringify(styleSheetText);

async function convertCdaToHtml(sourceFile: string) {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  const sourcePath = path.resolve(process.cwd(), sourceFile);
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file ${sourcePath} does not exist`);
    return;
  }

  const document = fs.readFileSync(sourcePath, { encoding: "utf8" });

  // Clean up the document according to the standard normalization process
  const normalizedDocument = cleanUpPayload(document);

  console.log(`Converting to HTML...`);
  const htmlStartedAt = Date.now();
  const html = await convertToHtml(normalizedDocument, console.log);
  const htmlDuration = Date.now() - htmlStartedAt;
  const sourceDirectory = path.dirname(sourcePath);
  const sourceFileName = path.basename(sourceFile, ".xml");
  const outputPath = path.join(sourceDirectory, `${sourceFileName}.html`);
  fs.writeFileSync(outputPath, html);
  console.log(`HTML file written to ${outputPath}`);

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

program.parse(process.argv);

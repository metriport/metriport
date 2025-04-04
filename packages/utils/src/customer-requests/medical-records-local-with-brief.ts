import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { convertStringToBrief } from "@metriport/core/command/ai-brief/brief";
import { getAiBriefContentFromBundle } from "@metriport/core/command/ai-brief/shared";
import { generateAiBriefBundleEntry } from "@metriport/core/domain/ai-brief/generate";
import { bundleToHtml } from "@metriport/core/external/aws/lambda-logic/bundle-to-html";
import { out } from "@metriport/core/util/log";
import fs from "fs";

/**
 * Script to trigger MR Summary generation on a FHIR payload locally, with the AI Brief included in it.
 *
 * The summary is created in HTML format.
 *
 * The result is a file called `output.html` on the root of `packages/utils`
 *
 * To run this script:
 * - Set the `patientId`, `cxId` consts.
 * - Specify the path to the FHIR Bundle payload - the output of `GET /consolidated`).
 * - Make sure to set the env vars in addition the ones below this comment block:
 *   - BEDROCK_REGION
 *   - BEDROCK_VERSION
 *   - MR_BRIEF_MODEL_ID
 */

const sourceFilePath = "";

const cxId = "";
const patientId = "";
// Update this to staging or local URL if you want to test the brief link
const dashUrl = "http://dash.metriport.com";

async function main() {
  if (!cxId || !patientId) throw new Error("cxId or patientId is missing");
  const { log } = out(`MR with Brief Local - cx ${cxId}, pat ${patientId}`);

  const rawBundle = fs.readFileSync(sourceFilePath, "utf8");
  const bundle = JSON.parse(rawBundle);

  const binaryBundleEntry = await generateAiBriefBundleEntry(bundle, cxId, patientId, log);
  console.log("binaryBundleEntry", JSON.stringify(binaryBundleEntry));
  console.log("bundle.leng bef", bundle.entry.length);
  if (binaryBundleEntry) {
    bundle.entry?.push(binaryBundleEntry);
  }
  console.log("bundle.leng aft", bundle.entry.length);

  const aiBriefContent = getAiBriefContentFromBundle(bundle);
  console.log("aiBriefContent", aiBriefContent);
  const aiBrief = convertStringToBrief({ aiBrief: aiBriefContent, dashUrl });
  console.log("aiBrief", aiBrief);

  const html = bundleToHtml(bundle, aiBrief);
  fs.writeFileSync("output.html", html);
}

main();

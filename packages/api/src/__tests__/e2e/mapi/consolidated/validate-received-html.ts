import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import fs from "fs";
import { checkConsolidatedHtml } from "./consolidated";

dayjs.extend(utc);

/**
 * Script to check a consolidated html file received from the API agains the code that validates
 * it in the E2E tests.
 *
 * - Update the patient ID to match the one on the html file.
 * - Update the path to the html file.
 * - Run the script (from `packages/api`):
 *   $ ts-node src/__tests__/e2e/mapi/consolidated/validate-received-html.ts
 */

const patientId = "018fefff-9ec1-7782-9e41-58eaebfa6890";
const receivedFileName = "consolidated-received";
const html = fs.readFileSync(`${__dirname}/${receivedFileName}.html`, "utf8");

const isMatch = checkConsolidatedHtml({
  html,
  patientId,
  // send a diff name so we don't override the default received one that might exist on the filesystem
  outputReceivedFileName: `${receivedFileName}_validate`,
});

console.log(`Matches? ${isMatch}`);

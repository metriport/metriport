import { documentQueryResponseSchema } from "@metriport/commonwell-sdk";
import * as fs from "fs";

/**
 * Utility to parse CW response payloads and report errors.
 *
 * Just update the filename below and run `ts-node src/parse-cw-response.ts`
 */
const filename = "doc-payload.json";

const separator = "############################################################\n";
const contents = fs.readFileSync(filename, "utf8");

console.log(">>> File contents:");
console.log(JSON.stringify(JSON.parse(contents), null, 2));
console.log(">>> File contents ^");

const result3 = documentQueryResponseSchema.safeParse(JSON.parse(contents));
if (result3.success) {
  console.log(separator);
  console.log(`>>> Success parsing file "${filename}"`);
} else {
  result3.error.issues.forEach(issue => {
    console.log(separator);
    console.log(JSON.stringify(issue, null, 2));
  });
  console.log(separator);
  console.log(`>>> Found ${result3.error.issues.length} errors.`);
}
console.log(``);

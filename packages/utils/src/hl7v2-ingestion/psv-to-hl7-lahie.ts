import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top

import { sleep } from "@metriport/core/util/sleep";
import { readFile } from "fs/promises";
import { PsvToHl7Converter } from "@metriport/core/command/hl7-sftp-ingestion/psv-to-hl7-converter";
import { getEnvVarOrFail } from "@metriport/shared/common/env-var";

/**
 * Runs the psv -> hl7 converter on an inputted file.
 * Expects a lahie psv file.
 *
 * inputs:
 *  - Set env variable
 *  - Set filename to the file you want to convert.
 *
 * usage:
 *  - Run the script using: ts-node src/hl7v2-ingestion/psv-to-hl7-lahie.ts
 */

const hl7ScramblerSeedSecret = getEnvVarOrFail("HL7_BASE64_SCRAMBLER_SEED");

const filename = "";

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  console.log(
    `Your scrambler seed secret: ${hl7ScramblerSeedSecret} should match the scrambler seed the file was encrypted with`
  );
  const buffer = await readFile(filename);
  const psvToHl7Converter = new PsvToHl7Converter(buffer);
  await psvToHl7Converter.getIdentifiedHl7Messages();
}

main();

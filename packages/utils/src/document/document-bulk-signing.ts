import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { getSignedUrls } from "@metriport/core/external/aws/lambda-logic/document-bulk-signing";
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
const sourceBucket = getEnvVarOrFail("SOURCE_BUCKET");
const region = getEnvVarOrFail("REGION");

async function main() {
  try {
    await getSignedUrls([""], sourceBucket, region);
    console.log("Successfully signed the files.");
  } catch (err) {
    console.log("Error signing the files:", err);
  }
}

main();

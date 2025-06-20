import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import { MedicalDataSource } from "@metriport/core/external";
import { Config } from "@metriport/core/util/config";
import { BadRequestError, sleep } from "@metriport/shared";
import { v4 as uuidv4 } from "uuid";
import { convertCDAToFHIR } from "../../../../api/src/external/fhir-converter/converter";
import { elapsedTimeAsStr } from "../../shared/duration";

/**
 * This script is used to convert CDA files to FHIR using the FHIR Converter connector in the
 * cloud. It sends messages to the SQS queue that the FHIR Converter lambda listens to.
 * The files are expected to be in a S3 bucket.
 *
 * Set these on the environment variables:
 * - FHIR_CONVERTER_QUEUE_URL
 * - FHIR_CONVERTER_SERVER_URL
 * - AWS_REGION
 * - MEDICAL_DOCUMENTS_BUCKET_NAME
 *
 * Make sure to edit connector-factory.ts so it uses the "cloud" implementation.
 */

const cxId = "";
const patientId = "";
const sourceParam = ""; // see MedicalDataSource
const fileNames: string[] = [];
const bucket = Config.getMedicalDocumentsBucketName();

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${new Date(startedAt).toISOString()} ##############`);

  if (!["COMMONWELL", "CAREQUALITY"].includes(sourceParam)) {
    throw new BadRequestError("Invalid source");
  }
  const source = sourceParam as MedicalDataSource;

  console.log(`Converting ${fileNames.length} files...`);

  for (const key of fileNames) {
    await convertCDAToFHIR({
      patient: { cxId, id: patientId },
      document: { id: uuidv4() },
      source,
      s3FileName: key,
      s3BucketName: bucket,
      requestId: uuidv4(),
    });
  }

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

if (require.main === module) {
  main();
}

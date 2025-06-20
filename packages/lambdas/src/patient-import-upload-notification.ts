import { PatientImportParseRequest } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse";
import { PatientImportParseCloud } from "@metriport/core/command/patient-import/steps/parse/patient-import-parse-cloud";
import { S3Utils } from "@metriport/core/external/aws/s3";
import { errorToString, MetriportError } from "@metriport/shared";
import { fromS3Metadata } from "@metriport/shared/domain/patient/patient-import/metadata";
import { S3Event } from "aws-lambda";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const region = getEnvOrFail("AWS_REGION");
const patientImportParseLambdaName = getEnvOrFail("PATIENT_IMPORT_PARSE_LAMBDA_NAME");

export const handler = capture.wrapHandler(async (event: S3Event) => {
  capture.setExtra({ context: `patient-import-upload-notification`, event });
  const errors: unknown[] = [];
  for (const record of event.Records) {
    const sourceBucket = record.s3.bucket.name;
    const sourceKey = decodeURIComponent(record.s3.object.key);
    // TODO 2330 Check record.s3.object.size against limit and update docs
    const sourceSizeInBytes = record.s3.object.size;
    console.log(
      "Running the bulk import upload notification with sourceBucket:",
      sourceBucket,
      "sourceKey:",
      sourceKey,
      "sourceSize:",
      sourceSizeInBytes,
      "bytes"
    );
    try {
      const s3Utils = new S3Utils(region);
      const { metadata } = await s3Utils.getFileInfoFromS3(sourceKey, sourceBucket);
      const parsedMetadata = fromS3Metadata(metadata);
      const isDev = parsedMetadata.isDev;

      // e.g.: patient-import/cxid=<UUID>/date=2025-01-01/jobid=<UUID>/files/raw.csv
      const sourceParts = sourceKey.split("/");
      const cxId = sourceParts.find(s => s.startsWith("cxid="))?.split("=")[1];
      const jobId = sourceParts.find(s => s.startsWith("jobid="))?.split("=")[1];
      if (!cxId || !jobId) {
        throw new Error(
          `Missing cxId or jobId in sourceKey ${sourceKey} - cxId: ${cxId}, jobId: ${jobId}`
        );
      }

      if (isDev) {
        console.log(
          `Running in dev mode, not calling the parse lambda, call the internal endpoint!`
        );
        continue;
      }

      const parseCloud = new PatientImportParseCloud(patientImportParseLambdaName);
      const payload: PatientImportParseRequest = { cxId, jobId };
      await parseCloud.processJobParse(payload);
    } catch (error) {
      console.log("Error processing new patient import file", sourceKey, errorToString(error));
      errors.push(error);
    }
  }
  if (errors.length > 0) {
    throw new MetriportError(`Errors processing new patient import file`, undefined, {
      count: errors.length,
    });
  }
});

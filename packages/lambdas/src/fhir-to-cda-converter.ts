import { Input } from "@metriport/core/domain/conversion/fhir-to-cda";
import { convertToCdaAndUpload } from "@metriport/core/fhir-to-cda/convert";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ cxId, patientId, bundle, organization }: Input): Promise<void> => {
    const { log } = out(`cx ${cxId}, patient ${patientId}`);
    log(
      `Running with: ${bundle.entry.length} resources, bundle type: ${bundle.type}, bucket: ${bucketName}}`
    );
    try {
      await convertToCdaAndUpload({
        cxId,
        patientId,
        bundle,
        organization,
      });

      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const msg = `Error converting FHIR bundle to CDA`;
      log(`${msg} - error: ${error.message}`);
      capture.error(msg, {
        extra: {
          error,
          cxId,
          patientId,
          context: lambdaName,
        },
      });
      throw error;
    }
  }
);

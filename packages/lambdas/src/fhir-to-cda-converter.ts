import { Input } from "@metriport/core/domain/conversion/fhir-to-cda";
import { BadRequestError } from "@metriport/shared";
import { splitBundleByCompositions } from "@metriport/core/fhir-to-cda/composition-splitter";
import { convertFhirBundleToCda } from "@metriport/core/fhir-to-cda/fhir-to-cda";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/serverless";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";

// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvOrFail("AWS_LAMBDA_FUNCTION_NAME");
const bucketName = getEnvOrFail("MEDICAL_DOCUMENTS_BUCKET_NAME");

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ cxId, bundle, orgOid, splitCompositions, isCustodian }: Input): Promise<string[]> => {
    const { log } = out(`cx ${cxId}`);
    log(
      `Running with: ${bundle.entry?.length} resources, bundle type: ${bundle.type}, bucket: ${bucketName}}`
    );
    try {
      const bundles = splitCompositions ? splitBundleByCompositions(bundle) : bundle;
      return convertFhirBundleToCda(bundles, orgOid, isCustodian);

      //eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      const msg = `Error converting FHIR bundle to CDA`;
      log(`${msg} - error: ${error.message}`);
      if (!(error instanceof BadRequestError)) {
        capture.error(msg, {
          extra: {
            error,
            cxId,
            context: lambdaName,
            orgOid,
          },
        });
      }
      throw error;
    }
  }
);

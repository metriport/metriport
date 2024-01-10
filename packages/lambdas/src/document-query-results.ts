import * as Sentry from "@sentry/serverless";
import { sendDocumentQueryResults } from "@metriport/core/command/documents/send-doc-query-results";
import { getEnvVarOrFail, getEnvVar, getEnvType } from "@metriport/core/util/env-var";
import { capture } from "./shared/capture";
import { errorToString } from "@metriport/core/util/error";

// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvVar("AWS_LAMBDA_FUNCTION_NAME");
const dbCreds = getEnvVarOrFail("DB_CREDS");
const apiUrl = getEnvVarOrFail("API_URL");

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    requestId,
    numOfLinks,
    patientId,
    cxId,
  }: {
    requestId: string;
    numOfLinks: number;
    patientId: string;
    cxId: string;
  }) => {
    capture.setExtra({ lambdaName: lambdaName });

    console.log(
      `Running with envType: ${getEnvType()}, requestId: ${requestId}, numOfLinks: ${numOfLinks} `
    );

    try {
      await sendDocumentQueryResults({
        requestId,
        patientId,
        cxId,
        numOfLinks,
        dbCreds,
        endpointUrl: apiUrl,
      });
    } catch (error) {
      const msg = `Error sending document query results`;
      console.log(`${msg}: ${errorToString(error)}`);
      capture.error(error, {
        extra: { context: `sendDocumentQueryResults`, error, patientId, requestId, cxId },
      });
    }
  }
);

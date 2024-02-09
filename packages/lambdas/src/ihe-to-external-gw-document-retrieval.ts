import * as Sentry from "@sentry/serverless";
import { sendIHEGatewayResults } from "@metriport/core/external/carequality/command/documents/send-ihe-gateway-results";
import {
  DOC_RETRIEVAL_RESULT_TABLE_NAME,
  IHEToExternalGwDocumentRetrieval,
} from "@metriport/core/external/carequality/ihe-result";
import { getEnvVarOrFail, getEnvVar, getEnvType } from "@metriport/core/util/env-var";
import { capture } from "./shared/capture";
import { errorToString } from "@metriport/core/util/error/shared";

// Keep this as early on the file as possible
capture.init();

const lambdaName = getEnvVar("AWS_LAMBDA_FUNCTION_NAME");
const dbCreds = getEnvVarOrFail("DB_CREDS");
const apiUrl = getEnvVarOrFail("API_URL");

capture.setExtra({ lambdaName: lambdaName });

export const handler = Sentry.AWSLambda.wrapHandler(
  async ({
    requestId,
    numOfGateways,
    patientId,
    cxId,
  }: {
    requestId: string;
    numOfGateways: number;
    patientId: string;
    cxId: string;
  }) => {
    console.log(
      `Running with envType: ${getEnvType()}, requestId: ${requestId}, numOfGateways: ${numOfGateways} `
    );

    const endpointUrl = `${apiUrl}/internal/carequality/document-retrieval/results`;

    try {
      await sendIHEGatewayResults<IHEToExternalGwDocumentRetrieval>({
        requestId,
        patientId,
        cxId,
        numOfGateways,
        dbCreds,
        endpointUrl,
        resultsTable: DOC_RETRIEVAL_RESULT_TABLE_NAME,
      });
    } catch (error) {
      const msg = `Error sending document retrieval results`;
      console.log(`${msg}: ${errorToString(error)}`);
      capture.error(error, {
        extra: {
          context: `sendIHEToExternalGwDocumentRetrievals`,
          error,
          patientId,
          requestId,
          cxId,
        },
      });
    }
  }
);

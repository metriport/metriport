import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";
import { PdRequestGatewayParams } from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway";
import { createSignSendProcessXcpdRequests } from "@metriport/core/external/ehex/ehex-gateway/outbound/ehex-gateway-logic";
import { getEnvType, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { out } from "@metriport/core/util/log";
import * as Sentry from "@sentry/serverless";
import { Context } from "aws-lambda";
import { capture } from "../shared/capture";
import { getEnvOrFail } from "../shared/env";
import { getEhexSamlCertsAndKeys } from "./secrets";

capture.init();
const { log } = out("ehex-gateway-outbound-patient-discovery");
const apiUrl = getEnvVarOrFail("API_URL");
const pdResponseUrl = `${apiUrl}/internal/ehex/patient-discovery/response`;

// Automatically set by AWS
const region = getEnvOrFail("AWS_REGION");

// Set by us
const featureFlagsTableName = getEnvOrFail("FEATURE_FLAGS_TABLE_NAME");

// Call this before reading FFs
FeatureFlags.init(region, featureFlagsTableName);

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ cxId, patientId, pdRequest }: PdRequestGatewayParams, context: Context) => {
    log(
      `Running with envType: ${getEnvType()}, requestId: ${pdRequest.id}, ` +
        `numOfGateways: ${pdRequest.gateways.length} cxId: ${cxId} patientId: ${patientId}`
    );
    const invocationId = context.awsRequestId;

    const samlCertsAndKeys = await getEhexSamlCertsAndKeys();
    await createSignSendProcessXcpdRequests({
      appInstanceId: invocationId,
      pdResponseUrl,
      xcpdRequest: pdRequest,
      samlCertsAndKeys,
      patientId,
      cxId,
    });
  }
);

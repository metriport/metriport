import * as Sentry from "@sentry/serverless";
import { PDRequestGatewayV2Params } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/ihe-gateway-v2";
import { createSignSendProcessXCPDRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/outbound/ihe-gateway-v2-logic";
import { out } from "@metriport/core/util/log";
import { getEnvVarOrFail, getEnvType } from "@metriport/core/util/env-var";
import { getSamlCertsAndKeys } from "./shared/secrets";
import { capture } from "./shared/capture";
import { getEnvOrFail } from "./shared/env";
import { FeatureFlags } from "@metriport/core/command/feature-flags/ffs-on-dynamodb";

capture.init();
const { log } = out("ihe-gateway-v2-outbound-patient-discovery");
const apiUrl = getEnvVarOrFail("API_URL");
const pdResponseUrl = `http://${apiUrl}/internal/carequality/patient-discovery/response`;

// Automatically set by AWS
const region = getEnvOrFail("AWS_REGION");

// Set by us
const featureFlagsTableName = getEnvOrFail("FEATURE_FLAGS_TABLE_NAME");

// Call this before reading FFs
FeatureFlags.init(region, featureFlagsTableName);

// TODO move to capture.wrapHandler()
export const handler = Sentry.AWSLambda.wrapHandler(
  async ({ cxId, patientId, pdRequestGatewayV2 }: PDRequestGatewayV2Params) => {
    log(
      `Running with envType: ${getEnvType()}, requestId: ${pdRequestGatewayV2.id}, ` +
        `numOfGateways: ${pdRequestGatewayV2.gateways.length} cxId: ${cxId} patientId: ${patientId}`
    );

    const samlCertsAndKeys = await getSamlCertsAndKeys();
    await createSignSendProcessXCPDRequest({
      pdResponseUrl,
      xcpdRequest: pdRequestGatewayV2,
      samlCertsAndKeys,
      patientId,
      cxId,
    });
  }
);

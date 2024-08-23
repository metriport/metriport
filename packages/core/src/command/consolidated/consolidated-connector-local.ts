import { executeWithNetworkRetries, InternalSendConsolidated } from "@metriport/shared";
import axios from "axios";
import { getConsolidatedFhirBundle } from "../../external/fhir/consolidated/consolidated";
import {
  ConsolidatedDataConnector,
  ConsolidatedDataRequestAsync,
  ConsolidatedDataRequestSync,
  ConsolidatedDataResponse,
} from "./consolidated-connector";
import { uploadConsolidatedBundleToS3 } from "./consolidated-on-s3";

const MAX_API_NOTIFICATION_ATTEMPTS = 5;

export class ConsolidatedDataConnectorLocal implements ConsolidatedDataConnector {
  constructor(private readonly bucketName: string, private readonly apiURL: string) {}

  async execute(
    params: ConsolidatedDataRequestSync | ConsolidatedDataRequestAsync
  ): Promise<ConsolidatedDataResponse> {
    const bundle = await getConsolidatedFhirBundle(params);
    const { bucket, key } = await uploadConsolidatedBundleToS3({
      ...params,
      bundle,
      s3BucketName: this.bucketName,
    });
    const info = {
      bundleLocation: bucket,
      bundleFilename: key,
    };
    if (params.isAsync) {
      const { patient, ...decomposedParams } = params;
      await postConsolidated({
        ...decomposedParams,
        apiURL: this.apiURL,
        cxId: patient.cxId,
        patientId: patient.id,
        bundleLocation: info.bundleLocation,
        bundleFilename: info.bundleFilename,
      });
    }
    return info;
  }
}

async function postConsolidated({
  apiURL,
  cxId,
  patientId,
  ...payload
}: InternalSendConsolidated & { cxId: string; patientId: string; apiURL: string }) {
  const postConsolidated = `${apiURL}/internal/patient/${patientId}/consolidated`;
  const queryParams = new URLSearchParams({ cxId });
  await executeWithNetworkRetries(
    () => axios.post(postConsolidated + "?" + queryParams.toString(), payload),
    {
      retryOnTimeout: false,
      maxAttempts: MAX_API_NOTIFICATION_ATTEMPTS,
    }
  );
}

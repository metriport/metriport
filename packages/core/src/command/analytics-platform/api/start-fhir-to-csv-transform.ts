import { errorToString, executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import axios from "axios";
import { Config } from "../../../util/config";
import { out } from "../../../util/log";

export type StartFhirToCsvTransformParams = {
  cxId: string;
  jobId: string;
  patientId: string;
  inputBundle?: string;
};

/**
 * Sends a request to the API to start the fhir to csv transform.
 *
 * @param cxId - The CX ID.
 * @param jobId - The job ID.
 * @param patientId - The patient ID.
 * @param inputBundle - The input bundle.
 */
export async function startFhirToCsvTransform({
  cxId,
  jobId,
  patientId,
  inputBundle,
}: StartFhirToCsvTransformParams): Promise<void> {
  const { log } = out(`Fhir to csv transform - cxId ${cxId}`);
  const api = axios.create({ baseURL: Config.getApiUrl() });
  const queryParams = new URLSearchParams({
    cxId,
    jobId,
    patientId,
    ...(inputBundle ? { inputBundle } : {}),
  });
  const startFhirToCsvTransformUrl = `/internal/analytics-platform/fhir-to-csv/transform?${queryParams.toString()}`;
  try {
    await executeWithNetworkRetries(async () => {
      return api.post(startFhirToCsvTransformUrl);
    });
  } catch (error) {
    const msg = "Failure while starting fhir to csv transform @ Api";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      cxId,
      jobId,
      patientId,
      inputBundle,
      url: startFhirToCsvTransformUrl,
      context: "analytics-platform.startFhirToCsvTransform",
    });
  }
}

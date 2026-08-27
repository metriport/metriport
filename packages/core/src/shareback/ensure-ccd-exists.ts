import { executeWithNetworkRetries } from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { S3Utils } from "../external/aws/s3";
import { createCcdDocumentPath } from "../shareback/file";
import { makeAxiosInstance } from "../util/axios";
import { Config } from "../util/config";
import { processAsyncError } from "../util/error/shared";

dayjs.extend(duration);

const apiUrl = Config.getApiLoadBalancerAddress();
const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const api = makeAxiosInstance();
const bucket = Config.getMedicalDocumentsBucketName();

export async function ensureCcdExists({
  cxId,
  patientId,
  log,
}: {
  cxId: string;
  patientId: string;
  log: typeof console.log;
}): Promise<void> {
  const destinationKey = createCcdDocumentPath({ cxId, patientId });
  const ccdExists = await s3Utils.fileExists(bucket, destinationKey);
  if (ccdExists) return;

  log(
    "No CCD found. Creating an empty one and triggering the generation of the real one in the background..."
  );
  const queryParams = {
    cxId,
    patientId,
  };
  const params = new URLSearchParams(queryParams).toString();

  await executeWithNetworkRetries(
    async () => await api.post(`${apiUrl}/internal/docs/empty-ccd?${params}`),
    { log }
  );

  executeWithNetworkRetries(async () => api.post(`${apiUrl}/internal/docs/ccd?${params}`), {
    log,
  }).catch(processAsyncError("Failed to trigger CCD generation", log, true));

  log(`Empty CCD generated at ${destinationKey}`);

  return;
}

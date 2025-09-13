import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { CCD_SUFFIX, createUploadFilePath } from "../domain/document/upload";
import { S3Utils } from "../external/aws/s3";
import { Config } from "../util/config";

dayjs.extend(duration);

const apiUrl = Config.getApiLoadBalancerAddress();
const region = Config.getAWSRegion();
const s3Utils = new S3Utils(region);
const api = axios.create();
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
  const destinationKey = createUploadFilePath(cxId, patientId, `${CCD_SUFFIX}.xml`);
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
  });

  log("CCD generated.");

  return;
}

import { executeWithNetworkRetries } from "@metriport/shared";
import axios from "axios";
import { S3Utils } from "../external/aws/s3";
import { Config } from "../util/config";
import { CCD_SUFFIX, createUploadFilePath } from "../domain/document/upload";

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

  log("No CCD found. Let's trigger generating one.");
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

  log("CCD generated. Fetching the document contents");
  return;
}

import { UploadParams } from "../../../external/aws/s3";

export type WriteToS3Request = (Omit<UploadParams, "file" | "key"> & {
  serviceId: string;
  filePath: string;
  fileName?: string;
  payload: string;
})[];

export interface S3Writer {
  writeToS3(requests: WriteToS3Request): Promise<void>;
}

const serviceIds = ["cq-patient-discovery-response"];
type ServiceId = (typeof serviceIds)[number];
export function isServiceId(serviceId: string): serviceId is ServiceId {
  return serviceIds.includes(serviceId);
}

export const bulkServices: ServiceId[] = ["cq-patient-discovery-response"];

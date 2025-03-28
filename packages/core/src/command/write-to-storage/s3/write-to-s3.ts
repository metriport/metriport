import { UploadParams } from "../../../external/aws/s3";

export type ProcessWriteToS3Request = Omit<UploadParams, "file" | "key"> & {
  serviceId: string;
  filePath: string;
  key?: string;
  payload: string;
};

export interface ProcessWriteToS3Handler {
  processWriteToS3(request: ProcessWriteToS3Request): Promise<void>;
}

const serviceIds = ["cq-patient-discovery-response"];
type ServiceId = (typeof serviceIds)[number];
export function isServiceId(serviceId: string): serviceId is ServiceId {
  return serviceIds.includes(serviceId);
}

export const bulkServices: ServiceId[] = ["cq-patient-discovery-response"];

import { Config } from "../util/config";
import { AuditLogService } from "./audit-log-service";
import { AuditLogServiceLocal } from "./audit-log-service-local";
import { AuditLogServiceS3 } from "./audit-log-service-s3";

export function buildAuditLogService(): AuditLogService {
  if (Config.isDev()) {
    return new AuditLogServiceLocal();
  }
  const bucketName = Config.getAuditLogsBucketName();
  const region = Config.getAWSRegion();
  return new AuditLogServiceS3(bucketName, region);
}

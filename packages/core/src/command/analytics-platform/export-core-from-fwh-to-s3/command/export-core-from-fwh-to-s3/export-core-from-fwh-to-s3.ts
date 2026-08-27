import { generateJobId } from "../../../utils";

export type ExportCoreFromFwhToS3Request = {
  cxId: string;
  rawToCoreJobId: string;
  jobId?: string;
};

export const EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE_EVENT_TYPE = "export.core.from.fwh.to.s3.complete";

export type ExportCoreFromFwhToS3CompletionMessage = {
  cxId: string;
  jobId: string;
  eventType: typeof EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE_EVENT_TYPE;
  timestamp: string;
};

export abstract class ExportCoreFromFwhToS3Handler {
  abstract exportCoreFromFwhToS3(request: ExportCoreFromFwhToS3Request): Promise<string>;

  generateJobId(): string {
    return generateJobId();
  }
}

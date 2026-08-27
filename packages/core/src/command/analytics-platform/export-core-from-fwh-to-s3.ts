import { BadRequestError } from "@metriport/shared";
import { isAnalyticsIncrementalIngestionEnabledForCx } from "../feature-flags/domain-ffs";
import { buildExportCoreFromFwhToS3Handler } from "./export-core-from-fwh-to-s3/command/export-core-from-fwh-to-s3/export-core-from-fwh-to-s3-factory";

export async function exportCoreFromFwhToS3({
  cxId,
  rawToCoreJobId,
}: {
  cxId: string;
  rawToCoreJobId: string;
}): Promise<string> {
  const isAnalyticsEnabled = await isAnalyticsIncrementalIngestionEnabledForCx(cxId);
  if (!isAnalyticsEnabled) {
    throw new BadRequestError(`Analytics is not enabled for cx`, undefined, { cxId });
  }

  const exportCoreFromFwhToS3Handler = buildExportCoreFromFwhToS3Handler();
  const jobId = await exportCoreFromFwhToS3Handler.exportCoreFromFwhToS3({ cxId, rawToCoreJobId });

  return jobId;
}

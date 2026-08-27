import { DbCreds } from "@metriport/shared";
import { out } from "../../../../../util";
import { Config } from "../../../../../util/config";
import { processAsyncError } from "../../../../../util/error/shared";
import { AnalyticsEventType, sendAnalyticsEvent } from "../../../utils";
import {
  EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE_EVENT_TYPE,
  ExportCoreFromFwhToS3CompletionMessage,
  ExportCoreFromFwhToS3Handler,
  ExportCoreFromFwhToS3Request,
} from "./export-core-from-fwh-to-s3";
import { exportCoreFromFwhToS3 as exportCoreFromFwhToS3Internal } from "./utils";
import { buildDayjs } from "@metriport/shared/common/date";

export class ExportCoreFromFwhToS3Direct extends ExportCoreFromFwhToS3Handler {
  constructor(
    private readonly dbCreds: DbCreds = Config.getAnalyticsDbCreds(),
    private readonly analyticsBucketName: string = Config.getAnalyticsBucketName(),
    private readonly region: string = Config.getAWSRegion(),
    private readonly exportCoreFromFwhToS3CompletionTopicArn:
      | string
      | undefined = Config.getExportCoreFromFwhToS3CompletionTopicArn()
  ) {
    super();
  }

  async exportCoreFromFwhToS3({
    cxId,
    rawToCoreJobId,
    jobId = this.generateJobId(),
  }: ExportCoreFromFwhToS3Request): Promise<string> {
    this.exportCoreFromFwhToS3Sync({ cxId, rawToCoreJobId, jobId }).catch(
      processAsyncError(`ExportCoreFromFwhToS3Direct exportCoreFromFwhToS3Sync`)
    );
    return jobId;
  }

  async exportCoreFromFwhToS3Sync({
    cxId,
    rawToCoreJobId,
    jobId = this.generateJobId(),
  }: ExportCoreFromFwhToS3Request): Promise<void> {
    const { log } = out(
      `ExportCoreFromFwhToS3Direct.exportCoreFromFwhToS3Sync - cx ${cxId}, job ${jobId}`
    );

    const numberOfTablesExported = await exportCoreFromFwhToS3Internal({
      cxId,
      rawToCoreJobId,
      jobId,
      dbCreds: this.dbCreds,
      analyticsBucketName: this.analyticsBucketName,
      region: this.region,
    });
    if (numberOfTablesExported < 1) return;

    const message: ExportCoreFromFwhToS3CompletionMessage = {
      cxId,
      jobId,
      eventType: EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE_EVENT_TYPE,
      timestamp: buildDayjs().toISOString(),
    };

    await sendAnalyticsEvent({
      eventType: AnalyticsEventType.EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE,
      topicArn: this.exportCoreFromFwhToS3CompletionTopicArn,
      message,
      subject: `Core Exported to S3 - ${cxId}`,
      log,
      messageGroupId: cxId,
      messageDeduplicationId: jobId,
    });
  }
}

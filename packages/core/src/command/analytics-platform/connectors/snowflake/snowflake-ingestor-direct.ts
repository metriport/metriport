import { buildDayjs } from "@metriport/shared/common/date";
import { SnowflakeCreds, SnowflakeSettingsForAllCxs } from "../../../../external/snowflake/creds";
import { Config } from "../../../../util/config";
import { processAsyncError } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { AnalyticsEventType, sendAnalyticsEvent } from "../../utils";
import {
  CONNECTOR_INGESTION_COMPLETE_EVENT_TYPE,
  ConnectorIngestionCompleteMessage,
} from "../utils";
import { SnowflakeIngestor, SnowflakeIngestorRequest } from "./snowflake-ingestor";
import { ingestCoreIntoSnowflake as ingestCoreIntoSnowflakeInternal } from "./utils";

export class SnowflakeIngestorDirect extends SnowflakeIngestor {
  constructor(
    private readonly snowflakeCredsForAllRegions: SnowflakeCreds = Config.getSnowflakeCredsForAllRegions(),
    private readonly snowflakeSettingsForAllCxs: SnowflakeSettingsForAllCxs = Config.getSnowflakeSettingsForAllCustomers(),
    private readonly analyticsBucketName: string = Config.getAnalyticsBucketName(),
    private readonly region: string = Config.getAWSRegion(),
    private readonly connectorIngestionCompleteTopicArn:
      | string
      | undefined = Config.getConnectorIngestionCompleteTopicArn()
  ) {
    super();
  }

  async ingestCoreIntoSnowflake({
    cxId,
    coreExportJobId,
    jobId = this.generateJobId(),
  }: SnowflakeIngestorRequest): Promise<string> {
    this.ingestCoreIntoSnowflakeSync({ cxId, coreExportJobId, jobId }).catch(
      processAsyncError(`SnowflakeIngestorDirect ingestCoreIntoSnowflakeSync`)
    );
    return jobId;
  }

  async ingestCoreIntoSnowflakeSync({
    cxId,
    coreExportJobId,
    jobId = this.generateJobId(),
  }: SnowflakeIngestorRequest): Promise<void> {
    const { log } = out(`SnowflakeIngestorDirect - cx ${cxId}, job ${jobId}`);

    const numberOfFilesIngested = await ingestCoreIntoSnowflakeInternal({
      cxId,
      jobId,
      coreExportJobId,
      snowflakeCredsForAllRegions: this.snowflakeCredsForAllRegions,
      snowflakeSettingsForAllCxs: this.snowflakeSettingsForAllCxs,
      analyticsBucketName: this.analyticsBucketName,
      region: this.region,
    });
    if (numberOfFilesIngested < 1) return;

    const message: ConnectorIngestionCompleteMessage = {
      cxId,
      jobId,
      eventType: CONNECTOR_INGESTION_COMPLETE_EVENT_TYPE,
      connector: "snowflake",
      timestamp: buildDayjs().toISOString(),
    };

    await sendAnalyticsEvent({
      eventType: AnalyticsEventType.CONNECTOR_INGESTION_COMPLETE,
      topicArn: this.connectorIngestionCompleteTopicArn,
      message,
      subject: `Connector Ingestion Complete - ${cxId}`,
      log,
      messageGroupId: cxId,
      messageDeduplicationId: jobId,
    });
  }
}

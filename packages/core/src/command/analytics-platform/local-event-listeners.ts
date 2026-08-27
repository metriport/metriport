import { errorToString } from "@metriport/shared";
import { out } from "../../util/log";
import { snowflakeIngest } from "./connectors/snowflake-ingest";
import { CoreToHedisCompletionMessage } from "./core-to-hedis/command/core-to-hedis";
import { exportCoreFromFwhToS3 } from "./export-core-from-fwh-to-s3";
import { ExportCoreFromFwhToS3CompletionMessage } from "./export-core-from-fwh-to-s3/command/export-core-from-fwh-to-s3/export-core-from-fwh-to-s3";
import { RawToCoreCompletionMessage } from "./raw-to-core/command/raw-to-core";
//import { rebuildHedis } from "./rebuild-hedis";
import { analyticsEventEmitter, AnalyticsEventType } from "./utils";

const { log } = out("AnalyticsEventListeners");

let isInitialized = false;

/**
 * Initializes the local event listeners for the analytics platform.
 * This should be called once at application startup in development environments.
 *
 * These listeners simulate the event-driven architecture that runs on AWS
 * (SNS → SQS → Lambda) by using Node.js EventEmitters locally.
 *
 * Event Flow:
 * 1. RAW_TO_CORE_COMPLETE → Export Core from FWH to S3
 * 2. EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE → Snowflake Connector
 * 3. CONNECTOR_INGESTION_COMPLETE → Analytics Webhook Consumer (logs only for now)
 * 4. CORE_TO_HEDIS_COMPLETE → (no downstream listener currently)
 */
export function initializeAnalyticsEventListeners(): void {
  if (isInitialized) {
    log("Analytics event listeners already initialized, skipping");
    return;
  }

  log("Initializing analytics event listeners for local development...");

  // RAW_TO_CORE_COMPLETE → Export Core from FWH to S3
  analyticsEventEmitter.on(
    AnalyticsEventType.RAW_TO_CORE_COMPLETE,
    async (message: RawToCoreCompletionMessage) => {
      log(`Received RAW_TO_CORE_COMPLETE event: ${JSON.stringify(message)}`);
      try {
        const { cxId, jobId } = message;
        await Promise.all([
          exportCoreFromFwhToS3({ cxId, rawToCoreJobId: jobId }) /* rebuildHedis({ cxId }) */,
        ]);
      } catch (error) {
        log(`Error handling RAW_TO_CORE_COMPLETE: ${errorToString(error)}`);
      }
    }
  );

  // EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE → Snowflake Connector
  analyticsEventEmitter.on(
    AnalyticsEventType.EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE,
    async (message: ExportCoreFromFwhToS3CompletionMessage) => {
      log(`Received EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE event: ${JSON.stringify(message)}`);
      try {
        const { cxId, jobId } = message;
        await snowflakeIngest({ cxId, coreExportJobId: jobId });
      } catch (error) {
        log(`Error handling EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE: ${errorToString(error)}`);
      }
    }
  );

  // CONNECTOR_INGESTION_COMPLETE → Analytics Webhook Consumer
  analyticsEventEmitter.on(
    AnalyticsEventType.CONNECTOR_INGESTION_COMPLETE,
    async (message: unknown) => {
      log(`Received CONNECTOR_INGESTION_COMPLETE event: ${JSON.stringify(message)}`);
      log(`[LOCAL] Analytics pipeline complete! Would trigger webhook notifications.`);
    }
  );

  // CORE_TO_HEDIS_COMPLETE → No downstream listener currently
  analyticsEventEmitter.on(
    AnalyticsEventType.CORE_TO_HEDIS_COMPLETE,
    async (message: CoreToHedisCompletionMessage) => {
      log(`Received CORE_TO_HEDIS_COMPLETE event: ${JSON.stringify(message)}`);
      log(`[LOCAL] Core to HEDIS transformation complete!`);
    }
  );

  isInitialized = true;
  log("Analytics event listeners initialized successfully");
}

/**
 * Removes all analytics event listeners.
 * Useful for testing or cleanup.
 */
export function removeAnalyticsEventListeners(): void {
  analyticsEventEmitter.removeAllListeners(AnalyticsEventType.RAW_TO_CORE_COMPLETE);
  analyticsEventEmitter.removeAllListeners(AnalyticsEventType.EXPORT_CORE_FROM_FWH_TO_S3_COMPLETE);
  analyticsEventEmitter.removeAllListeners(AnalyticsEventType.CONNECTOR_INGESTION_COMPLETE);
  analyticsEventEmitter.removeAllListeners(AnalyticsEventType.CORE_TO_HEDIS_COMPLETE);
  isInitialized = false;
  log("Analytics event listeners removed");
}

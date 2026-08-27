import { executeWithNetworkRetries, MetriportError, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { Config } from "../../../../util/config";
import { processAsyncError } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { addCxToFeatureFlag } from "../../../feature-flags/domain-ffs";
import { appendFdwSchemaSuffix, rawDbSchema } from "../../fwh/utils";
import { AnalyticsEventType, sendAnalyticsEvent } from "../../utils";
import {
  RAW_TO_CORE_COMPLETE_EVENT_TYPE,
  RawToCoreCompletionMessage,
  RawToCoreHandler,
  RawToCoreRequest,
} from "./raw-to-core";

export type RawToCoreServiceRequest = {
  CX_ID: string;
  DATABASE: string;
  SCHEMA: string;
  JOB_ID: string;
  FULL_REFRESH: string;
  LOOKBACK_TIMESTAMP: string;
  LOOKBACK_HOURS: string;
};

export class RawToCoreHttp extends RawToCoreHandler {
  constructor(
    private readonly schema: string = appendFdwSchemaSuffix(rawDbSchema),
    private readonly httpEndpoint: string = Config.getRawToCoreHttpEndpoint(),
    private readonly rawToCoreCompletionTopicArn:
      | string
      | undefined = Config.getRawToCoreCompletionTopicArn()
  ) {
    super();
  }

  async processRawToCore(params: RawToCoreRequest) {
    const jobId = params.jobId || this.generateJobId();
    const fullRefresh = params.fullRefresh ?? false;
    this.processRawToCoreSync({ ...params, jobId, fullRefresh }).catch(
      processAsyncError(`RawToCoreHttp processRawToCore`)
    );
    return jobId;
  }

  async processRawToCoreSync(
    params: Omit<RawToCoreRequest, "jobId" | "fullRefresh"> & {
      jobId: string;
      fullRefresh: boolean;
    }
  ): Promise<void> {
    const { cxId, jobId, database, fullRefresh, lookbackTimestamp, lookbackHours, delay } = params;
    const { log } = out(`RawToCoreHttp - cx ${cxId}, job ${jobId}`);

    log(`Calling HTTP endpoint ${this.httpEndpoint}/transform`);

    const payload: RawToCoreServiceRequest = {
      CX_ID: cxId,
      JOB_ID: jobId,
      DATABASE: database,
      SCHEMA: this.schema,
      FULL_REFRESH: fullRefresh.toString(),
      LOOKBACK_TIMESTAMP: lookbackTimestamp?.toISOString() ?? "none",
      LOOKBACK_HOURS: lookbackHours?.toString() ?? "none",
    };

    if (delay) {
      log(`Sleeping for ${delay.asMilliseconds()} milliseconds`);
      await sleep(delay.asMilliseconds());
    }

    await executeWithNetworkRetries(async () => {
      const response = await axios.post(`${this.httpEndpoint}/transform`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      if (response.status !== 200) {
        throw new MetriportError(`HTTP request failed with status ${response.status}`, undefined, {
          status: response.status,
          statusText: response.statusText,
        });
      }
      log(`Raw to Core transform completed successfully`);
      return response.data;
    });

    if (fullRefresh) {
      try {
        await addCxToFeatureFlag({
          featureFlagName: "cxsWithAnalyticsIncrementalRawToCore",
          cxId,
        });
      } catch (error) {
        log(`Failed to add cx to feature flag: ${error}`);
      }
    }

    const message: RawToCoreCompletionMessage = {
      cxId,
      jobId,
      database,
      eventType: RAW_TO_CORE_COMPLETE_EVENT_TYPE,
      timestamp: buildDayjs().toISOString(),
    };

    await sendAnalyticsEvent({
      eventType: AnalyticsEventType.RAW_TO_CORE_COMPLETE,
      topicArn: this.rawToCoreCompletionTopicArn,
      message,
      subject: `Raw to Core Complete - ${cxId}`,
      log,
      messageGroupId: cxId,
      messageDeduplicationId: jobId,
    });
  }
}

import { executeWithNetworkRetries, MetriportError } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import axios from "axios";
import { Config } from "../../../../util/config";
import { processAsyncError } from "../../../../util/error/shared";
import { out } from "../../../../util/log";
import { coreDbSchema } from "../../fwh/utils";
import { AnalyticsEventType, sendAnalyticsEvent } from "../../utils";
import {
  CORE_TO_HEDIS_COMPLETE_EVENT_TYPE,
  CoreToHedisCompletionMessage,
  CoreToHedisHandler,
  CoreToHedisRequest,
} from "./core-to-hedis";

export type CoreToHedisServiceRequest = {
  DATABASE: string;
  SCHEMA: string;
};

export class CoreToHedisHttp extends CoreToHedisHandler {
  constructor(
    private readonly schema: string = coreDbSchema,
    private readonly httpEndpoint: string = Config.getCoreToHedisHttpEndpoint(),
    private readonly coreToHedisCompletionTopicArn:
      | string
      | undefined = Config.getCoreToHedisCompletionTopicArn()
  ) {
    super();
  }

  async processCoreToHedis(params: CoreToHedisRequest): Promise<string> {
    const jobId = params.jobId || this.generateJobId();
    this.processCoreToHedisSync({ ...params, jobId }).catch(
      processAsyncError(`CoreToHedisHttp processCoreToHedisSync`)
    );
    return jobId;
  }

  async processCoreToHedisSync(
    params: Omit<CoreToHedisRequest, "jobId"> & { jobId: string }
  ): Promise<void> {
    const { cxId, jobId, database } = params;
    const { log } = out(`CoreToHedisHttp - cx ${cxId}, job ${jobId}`);

    log(`Calling HTTP endpoint ${this.httpEndpoint}/transform`);

    const payload: CoreToHedisServiceRequest = {
      DATABASE: database,
      SCHEMA: this.schema,
    };

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
      log(`Core to HEDIS transform completed successfully`);
    });

    const message: CoreToHedisCompletionMessage = {
      cxId,
      jobId,
      database,
      eventType: CORE_TO_HEDIS_COMPLETE_EVENT_TYPE,
      timestamp: buildDayjs().toISOString(),
    };

    await sendAnalyticsEvent({
      eventType: AnalyticsEventType.CORE_TO_HEDIS_COMPLETE,
      topicArn: this.coreToHedisCompletionTopicArn,
      message,
      subject: `Core to HEDIS Complete - ${cxId}`,
      log,
      messageGroupId: cxId,
      messageDeduplicationId: jobId,
    });
  }
}

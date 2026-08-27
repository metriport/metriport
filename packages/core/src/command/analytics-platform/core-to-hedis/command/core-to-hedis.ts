import { generateJobId } from "../../utils";

export type CoreToHedisRequest = {
  cxId: string;
  database: string;
  jobId?: string;
};

export const CORE_TO_HEDIS_COMPLETE_EVENT_TYPE = "core.to.hedis.complete";

export type CoreToHedisCompletionMessage = {
  cxId: string;
  jobId: string;
  database: string;
  eventType: typeof CORE_TO_HEDIS_COMPLETE_EVENT_TYPE;
  timestamp: string;
};

export abstract class CoreToHedisHandler {
  abstract processCoreToHedis(request: CoreToHedisRequest): Promise<string>;

  generateJobId(): string {
    return generateJobId();
  }
}

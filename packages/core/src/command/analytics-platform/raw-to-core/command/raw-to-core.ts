import type { Dayjs } from "dayjs";
import type { Duration } from "dayjs/plugin/duration";
import { generateJobId } from "../../utils";

export type RawToCoreRequest = {
  cxId: string;
  database: string;
  jobId?: string;
  fullRefresh?: boolean;
  lookbackTimestamp?: Dayjs;
  lookbackHours?: number;
  delay?: Duration;
};

export const RAW_TO_CORE_COMPLETE_EVENT_TYPE = "raw.to.core.complete";

export type RawToCoreCompletionMessage = {
  cxId: string;
  jobId: string;
  database: string;
  eventType: typeof RAW_TO_CORE_COMPLETE_EVENT_TYPE;
  timestamp: string;
};

export abstract class RawToCoreHandler {
  abstract processRawToCore(request: RawToCoreRequest): Promise<string>;

  generateJobId(): string {
    return generateJobId();
  }
}

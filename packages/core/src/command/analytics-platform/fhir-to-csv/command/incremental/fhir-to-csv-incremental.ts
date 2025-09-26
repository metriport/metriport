import { buildDayjs } from "@metriport/shared/common/date";
import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nanoid = customAlphabet(alphabet, 10);

export type ProcessFhirToCsvIncrementalRequest = {
  cxId: string;
  patientId: string;
  /** Represents the call to processFhirToCsvIncremental. If not provided, a jobId will be generated. */
  jobId?: string;
  timeoutInMillis?: number | undefined;
};

export abstract class FhirToCsvIncrementalHandler {
  abstract processFhirToCsvIncremental(
    request: ProcessFhirToCsvIncrementalRequest
  ): Promise<string>;

  generateJobId(): string {
    return (
      buildDayjs().toISOString().replace(/[-:.]/g, "").replace("T", "-").substring(0, 18) +
      "-" +
      nanoid()
    );
  }
}

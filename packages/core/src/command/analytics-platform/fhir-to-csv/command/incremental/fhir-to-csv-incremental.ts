import { generateJobId } from "../../../utils";

export type ProcessFhirToCsvIncrementalRequest = {
  cxId: string;
  patientId: string;
  /** Represents the call to processFhirToCsvIncremental. If not provided, a jobId will be generated. */
  jobId?: string;
};

export abstract class FhirToCsvIncrementalHandler {
  abstract processFhirToCsvIncremental(
    request: ProcessFhirToCsvIncrementalRequest
  ): Promise<string>;

  generateJobId(): string {
    return generateJobId();
  }
}

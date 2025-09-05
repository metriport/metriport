import { sleep } from "@metriport/shared";
import { startFhirToCsvTransform } from "../fhir-to-csv-transform";
import { FhirToCsvBulkHandler, ProcessFhirToCsvBulkRequest } from "./fhir-to-csv-bulk";

export class FhirToCsvBulkDirect implements FhirToCsvBulkHandler {
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async processFhirToCsvBulk({
    cxId,
    jobId,
    patientId,
    outputPrefix,
    timeoutInMillis,
  }: ProcessFhirToCsvBulkRequest): Promise<void> {
    await startFhirToCsvTransform({
      cxId,
      jobId,
      patientId,
      outputPrefix,
      timeoutInMillis,
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

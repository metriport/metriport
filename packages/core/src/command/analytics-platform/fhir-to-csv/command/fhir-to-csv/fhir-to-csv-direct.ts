import { sleep } from "@metriport/shared";
import { startFhirToCsvTransform } from "../fhir-to-csv-transform";
import { FhirToCsvHandler, ProcessFhirToCsvRequest } from "./fhir-to-csv";

export class FhirToCsvDirect implements FhirToCsvHandler {
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async processFhirToCsv({
    cxId,
    jobId,
    patientId,
    inputBundle,
    timeoutInMillis,
  }: ProcessFhirToCsvRequest): Promise<void> {
    await startFhirToCsvTransform({
      cxId,
      jobId,
      patientId,
      ...(inputBundle ? { inputBundle } : {}),
      timeoutInMillis,
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

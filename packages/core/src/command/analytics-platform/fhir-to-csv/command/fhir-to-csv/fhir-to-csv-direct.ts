import { sleep } from "@metriport/shared";
import { startFhirToCsvTransformThroughApi } from "../../../api/start-fhir-to-csv-transform";
import { FhirToCsvHandler, ProcessFhirToCsvRequest } from "./fhir-to-csv";

export class FhirToCsvDirect implements FhirToCsvHandler {
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async processFhirToCsv({
    cxId,
    jobId,
    patientId,
    inputBundle,
  }: ProcessFhirToCsvRequest): Promise<void> {
    await startFhirToCsvTransformThroughApi({
      cxId,
      jobId,
      patientId,
      ...(inputBundle ? { inputBundle } : {}),
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

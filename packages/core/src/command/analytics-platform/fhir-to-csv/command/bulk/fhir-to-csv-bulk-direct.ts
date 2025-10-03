import { sleep } from "@metriport/shared";
import { buildFhirToCsvTransformHandler } from "../transform/fhir-to-csv-transform-factory";
import { FhirToCsvBulkHandler, ProcessFhirToCsvBulkRequest } from "./fhir-to-csv-bulk";

export class FhirToCsvBulkDirect implements FhirToCsvBulkHandler {
  constructor(private readonly waitTimeInMillis: number = 0) {}

  async processFhirToCsvBulk({
    cxId,
    patientId,
    outputPrefix,
    timeoutInMillis,
  }: ProcessFhirToCsvBulkRequest): Promise<void> {
    const handler = buildFhirToCsvTransformHandler();
    await handler.runFhirToCsvTransform({
      cxId,
      patientId,
      outputPrefix,
      timeoutInMillis,
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

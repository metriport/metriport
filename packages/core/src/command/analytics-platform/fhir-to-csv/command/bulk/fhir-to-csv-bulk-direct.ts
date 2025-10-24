import { errorToString, sleep } from "@metriport/shared";
import { out } from "../../../../../util";
import { buildFhirToCsvTransformHandler } from "../transform/fhir-to-csv-transform-factory";
import { FhirToCsvBulkHandler, ProcessFhirToCsvBulkRequest } from "./fhir-to-csv-bulk";

export class FhirToCsvBulkDirect implements FhirToCsvBulkHandler {
  constructor(private readonly waitTimeInMillis: number = 0) {}

  /**
   * Triggers the conversion of consolidated/FHIR to CSV in bulk.
   *
   * The conversion happens synchronously by calling the transform lambda for each patient.
   *
   * @param request - The request object.
   * @returns The IDs of the patients that failed to convert.
   */
  async processFhirToCsvBulk({
    cxId,
    patientIds,
    outputPrefix,
    timeoutInMillis,
  }: ProcessFhirToCsvBulkRequest): Promise<string[]> {
    const { log } = out(`FhirToCsvBulkDirect.processFhirToCsvBulk - cx ${cxId}`);

    const handler = buildFhirToCsvTransformHandler();
    const failedPatientIds: string[] = [];
    log(`Sending ${patientIds.length} patients to queue...`);
    for (const patientId of patientIds) {
      try {
        await handler.startFhirToCsvTransform({
          cxId,
          patientId,
          outputPrefix,
          timeoutInMillis,
        });
        if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
      } catch (error) {
        log(
          `Failed to put message on queue for patient ${patientId} - reason: ${errorToString(
            error
          )}`
        );
        failedPatientIds.push(patientId);
      }
    }
    return failedPatientIds;
  }
}

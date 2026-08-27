import { errorToString, MetriportError, sleep } from "@metriport/shared";
import { out } from "../../../../../util";
import { buildFhirToCsvTransformHandler } from "../transform/fhir-to-csv-transform-factory";
import { FhirToCsvBulkHandler, ProcessFhirToCsvBulkRequest } from "./fhir-to-csv-bulk";
import { doesConsolidatedDataExist } from "../../../../consolidated/consolidated-exists";
import { buildFhirToCsvBulkPatientPrefixFromBulkJobPrefix } from "../../file-name";

export class FhirToCsvBulkDirect implements FhirToCsvBulkHandler {
  constructor(private readonly waitTimeInMillis: number = 0) {}

  /**
   * Triggers the conversion of consolidated/FHIR to CSV in bulk.
   *
   * The conversion happens synchronously by calling the transform lambda for each patient.
   *
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
    log(`Processing ${patientIds.length} patients...`);
    for (const patientId of patientIds) {
      try {
        const doesPatientHaveConsolidatedBundle = await doesConsolidatedDataExist(cxId, patientId);
        if (!doesPatientHaveConsolidatedBundle) {
          const msg = `Patient does not have a consolidated bundle`;
          log(msg);
          throw new MetriportError(msg, undefined, { cxId, patientId });
        }
        await handler.runFhirToCsvTransform({
          cxId,
          patientId,
          outputPrefix: buildFhirToCsvBulkPatientPrefixFromBulkJobPrefix({
            bulkJobPrefix: outputPrefix,
            patientId,
          }),
          timeoutInMillis,
        });
        if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
      } catch (error) {
        log(`Failed to process patient ${patientId} - reason: ${errorToString(error)}`);
        failedPatientIds.push(patientId);
      }
    }
    return failedPatientIds;
  }
}

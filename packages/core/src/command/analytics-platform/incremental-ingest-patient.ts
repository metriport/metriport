import { BadRequestError } from "@metriport/shared";
import { isAnalyticsIncrementalIngestionEnabledForCx } from "../feature-flags/domain-ffs";
import { buildFhirToCsvIncrementalHandler } from "./fhir-to-csv/command/incremental/fhir-to-csv-incremental-factory";

export async function incrementalIngestPatient({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<string | undefined> {
  const isAnalyticsEnabled = await isAnalyticsIncrementalIngestionEnabledForCx(cxId);
  if (!isAnalyticsEnabled) {
    throw new BadRequestError(`Analytics is not enabled for cx`, undefined, { cxId });
  }

  const fhirToCsvHandler = buildFhirToCsvIncrementalHandler();
  const jobId = await fhirToCsvHandler.processFhirToCsvIncremental({ cxId, patientId });

  return jobId;
}

import { out } from "../../util/log";
import { isAnalyticsIncrementalIngestionEnabledForCx } from "../feature-flags/domain-ffs";
import { buildFhirToCsvIncrementalHandler } from "./fhir-to-csv/command/incremental/fhir-to-csv-incremental-factory";

export async function ingestPatientIntoAnalyticsPlatform({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<string | undefined> {
  const { log } = out(`ingestPatientIntoAnalyticsPlatform - cx ${cxId}, pt ${patientId}`);

  const isAnalyticsEnabled = await isAnalyticsIncrementalIngestionEnabledForCx(cxId);
  if (!isAnalyticsEnabled) return undefined;

  log(`Ingesting pt consolidated into analytics platform`);

  const fhirToCsvHandler = buildFhirToCsvIncrementalHandler();
  const jobId = fhirToCsvHandler.processFhirToCsvIncremental({ cxId, patientId });

  return jobId;
}

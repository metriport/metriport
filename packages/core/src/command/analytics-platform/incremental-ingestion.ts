import { out } from "../../util/log";
import { isAnalyticsIncrementalIngestionEnabledForCx } from "../feature-flags/domain-ffs";
// import { buildFhirToCsvHandler } from "./fhir-to-csv/command/fhir-to-csv/fhir-to-csv-factory";

export async function ingestPatientIntoAnalyticsPlatform({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<void> {
  const { log } = out(`ingestPatientIntoAnalyticsPlatform - cx ${cxId}, pt ${patientId}`);

  const isAnalyticsEnabled = await isAnalyticsIncrementalIngestionEnabledForCx(cxId);
  if (!isAnalyticsEnabled) return;

  // TODO ENG-743 implement this
  log(`WOULD BE ingesting pt consolidated into analytics platform`);
  // log(`Ingesting pt consolidated into analytics platform`);

  // const fhirToCsvHandler = buildFhirToCsvHandler();
  // fhirToCsvHandler.processFhirToCsv({
  //   cxId,
  //   patientId,
  //   jobId,
  //   outputPrefix,
  // });
}

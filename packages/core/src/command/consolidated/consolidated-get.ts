import { Bundle, Resource } from "@medplum/fhirtypes";
import { ConsolidationConversionType, ResourceTypeForConsolidation } from "@metriport/api-sdk";
import { parseFhirBundle, SearchSetBundle } from "@metriport/shared/medical";
import { createConsolidatedDataFilePath } from "../../domain/consolidated/filename";
import { Patient } from "../../domain/patient";
import { executeWithRetriesS3, returnUndefinedOn404, S3Utils } from "../../external/aws/s3";
import { out } from "../../util";
import { Config } from "../../util/config";
import { processAsyncError } from "../../util/error/shared";
import { getConsolidatedLocation } from "./consolidated-shared";
import { ConsolidatedSnapshotRequestAsync, ConsolidatedSnapshotRequestSync } from "./get-snapshot";
import { buildConsolidatedSnapshotConnector } from "./get-snapshot-factory";
import { getConsolidatedSnapshotFromS3 } from "./snapshot-on-s3";

const s3Utils = new S3Utils(Config.getAWSRegion());

const defaultS3RetriesConfig = {
  maxAttempts: 3,
  initialDelay: 500,
};

export type Consolidated = {
  bundle: Bundle<Resource> | undefined;
  fileLocation: string;
  fileName: string;
};

type GetConsolidatedPatientData = {
  patient: Patient;
  resources?: ResourceTypeForConsolidation[];
  dateFrom?: string;
  dateTo?: string;
  requestId?: string;
  fromDashboard?: boolean;
  // TODO 2215 Remove this when we have contributed data as part of get consolidated (from S3)
  forceDataFromFhir?: boolean;
};

export async function getConsolidatedFile({
  cxId,
  patientId,
  fileLocation = getConsolidatedLocation(),
}: {
  cxId: string;
  patientId: string;
  fileLocation?: string;
}): Promise<Consolidated> {
  const { log } = out(`getConsolidated - cx ${cxId}, pat ${patientId}`);
  const fileName = createConsolidatedDataFilePath(cxId, patientId);

  const consolidatedDataRaw = await executeWithRetriesS3<string | undefined>(
    async () => returnUndefinedOn404(() => s3Utils.getFileContentsAsString(fileLocation, fileName)),
    { ...defaultS3RetriesConfig, log }
  );
  const bundle = parseConsolidatedRaw(consolidatedDataRaw, log);
  return { bundle, fileLocation, fileName };
}

function parseConsolidatedRaw(
  contents: string | undefined,
  log: typeof console.log
): Bundle | undefined {
  if (!contents) return undefined;
  log(`Converting payload to JSON, length ${contents.length}`);
  return parseFhirBundle(contents);
}

/**
 * Get consolidated patient data.
 * Uses ConsolidatedDataConnector, which uses an environment-specific strategy/implementation
 * to load the data:
 * - dev/local: loads data directly;
 * - cloud envs, calls a lambda to execute the loading of data.
 *
 * @param patient
 * @param requestId
 * @param resources (Optional) List of resources to filter by. If provided, only
 *                  those resources will be included.
 * @param dateFrom (Optional) Start date to filter by.
 * @param dateTo (Optional) End date to filter by.
 * @param fromDashboard (Optional) Whether the request is coming from the dashboard.
 * @param forceDataFromFhir (Optional) Whether to force the data to be loaded from the FHIR server.
 * @returns FHIR bundle of resources matching the filters.
 */
export async function getConsolidatedPatientData({
  patient,
  requestId,
  resources,
  dateFrom,
  dateTo,
  fromDashboard = false,
  forceDataFromFhir = false,
}: GetConsolidatedPatientData): Promise<SearchSetBundle> {
  const payload: ConsolidatedSnapshotRequestSync = {
    patient,
    resources,
    requestId,
    dateFrom,
    dateTo,
    isAsync: false,
    fromDashboard,
    forceDataFromFhir,
  };
  const connector = buildConsolidatedSnapshotConnector();
  const { bundleLocation, bundleFilename } = await connector.execute(payload);
  const bundle = await getConsolidatedSnapshotFromS3({ bundleLocation, bundleFilename });
  return bundle;
}

export async function getConsolidatedPatientDataAsync({
  patient,
  resources,
  dateFrom,
  dateTo,
  requestId,
  conversionType,
  fromDashboard,
}: GetConsolidatedPatientData & {
  requestId: string;
  conversionType: ConsolidationConversionType;
}): Promise<void> {
  const payload: ConsolidatedSnapshotRequestAsync = {
    patient,
    requestId,
    conversionType,
    resources,
    dateFrom,
    dateTo,
    isAsync: true,
    fromDashboard,
  };
  const connector = buildConsolidatedSnapshotConnector();
  connector
    .execute(payload)
    .catch(processAsyncError("Failed to get consolidated patient data async", undefined, true));
}

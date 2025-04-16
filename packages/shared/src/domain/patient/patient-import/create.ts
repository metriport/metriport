import { buildDayjs } from "../../../common/date";
import { uuidv7 } from "../../../util/uuid-v7";
import { PatientImportStatus } from "./status";
import { PatientImport, PatientImportParamsCx, PatientImportParamsOps } from "./types";

export const initialStatus: PatientImportStatus = "waiting";
/**
 * Creates a new patient import.
 *
 * @param cxId - The customer ID.
 * @param facilityId - The facility ID.
 * @param paramsCx - The customer-specific parameters.
 * @param paramsOps - The operations-specific parameters.
 * @returns The patient import.
 */
export function createPatientImport({
  cxId,
  facilityId,
  paramsCx = {},
  paramsOps = {},
}: {
  cxId: string;
  facilityId: string;
  paramsCx?: Partial<PatientImportParamsCx>;
  paramsOps?: Partial<PatientImportParamsOps>;
}): PatientImport {
  const { dryRun: dryRunCx = false } = paramsCx;
  const initializedParamsCx: PatientImportParamsCx = {
    dryRun: dryRunCx,
  };

  const {
    rerunPdOnNewDemographics = false,
    triggerConsolidated = false,
    disableWebhooks = false,
  } = paramsOps;
  const initializedParamsOps: PatientImportParamsOps = {
    rerunPdOnNewDemographics,
    triggerConsolidated,
    disableWebhooks,
    ...(paramsOps?.dryRun ? { dryRun: paramsOps.dryRun } : {}),
  };

  const jobId = uuidv7();
  const status = initialStatus;
  const createdAt = buildDayjs().toDate();

  const patientImportJob: PatientImport = {
    id: jobId,
    cxId,
    facilityId,
    status,
    reason: undefined,
    createdAt,
    startedAt: undefined,
    finishedAt: undefined,
    total: 0,
    successful: 0,
    failed: 0,
    paramsCx: initializedParamsCx,
    paramsOps: initializedParamsOps,
  };

  return patientImportJob;
}

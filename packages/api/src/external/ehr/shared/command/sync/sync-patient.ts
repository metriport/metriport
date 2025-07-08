import { processAsyncError } from "@metriport/core/util/error/shared";
import { BadRequestError, MetriportError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getCxMappingsByCustomer } from "../../../../../command/mapping/cx";
import {
  findOrCreatePatientMapping,
  getPatientMapping,
} from "../../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { syncAthenaPatientIntoMetriport } from "../../../athenahealth/command/sync-patient";
import { syncCanvasPatientIntoMetriport } from "../../../canvas/command/sync-patient";
import { syncElationPatientIntoMetriport } from "../../../elation/command/sync-patient";
import { syncHealthiePatientIntoMetriport } from "../../../healthie/command/sync-patient";
import { isDqCooldownExpired } from "../../utils/patient";

export type SyncPatientParams = {
  ehr: EhrSource;
  cxId: string;
  practiceId?: string;
  ehrPatientId: string;
  departmentId?: string;
  triggerDq?: boolean;
  triggerDqForExistingPatient?: boolean;
};

export type SyncPatientParamsWithPracticeId = Omit<
  SyncPatientParams,
  "triggerDq" | "triggerDqForExistingPatient"
> & { practiceId: string };

/**
 * Get the client with token id and environment for the EHRs that support two-legged auth
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param practiceId - The practice id of the EHR integration. Optional, will be fetched from the CX mapping if not provided.
 * @param ehrPatientId - The patient id of the EHR integration.
 * @param departmentId - The department id of the EHR integration. Optional, will be fetched from the CX mapping if not provided.
 * @param triggerDq - Whether to trigger the data quality check.
 * @param triggerDqForExistingPatient - Whether to trigger the data quality check for existing patients.
 */
export async function syncPatient({
  ehr,
  cxId,
  practiceId: practiceIdParam,
  ehrPatientId,
  departmentId,
  triggerDq,
  triggerDqForExistingPatient,
}: SyncPatientParams): Promise<string> {
  const practiceId =
    practiceIdParam ?? (await getCxMappingWithoutPracticeId({ cxId, ehr })).externalId;
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: ehrPatientId,
    source: ehr,
  });
  if (existingPatient) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    if (triggerDqForExistingPatient && isDqCooldownExpired(metriportPatient)) {
      queryDocumentsAcrossHIEs({
        cxId,
        patientId: metriportPatient.id,
      }).catch(processAsyncError(`${ehr} queryDocumentsAcrossHIEs`));
    }
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }
  const handler = getSyncPatientHandler(ehr);
  const metriportPatientId = await handler({
    ehr,
    cxId,
    practiceId,
    ehrPatientId,
    departmentId,
  });
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatientId,
    }).catch(processAsyncError(`${ehr} queryDocumentsAcrossHIEs`));
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatientId,
    externalId: ehrPatientId,
    source: ehr,
  });
  return metriportPatientId;
}

type SyncPatientFn = (params: SyncPatientParamsWithPracticeId) => Promise<string>;

type SyncPatientFnMap = Record<EhrSource, SyncPatientFn | undefined>;

const syncPatientMethodsBy: SyncPatientFnMap = {
  [EhrSources.canvas]: syncCanvasPatientIntoMetriport,
  [EhrSources.athena]: syncAthenaPatientIntoMetriport,
  [EhrSources.elation]: syncElationPatientIntoMetriport,
  [EhrSources.healthie]: syncHealthiePatientIntoMetriport,
  [EhrSources.eclinicalworks]: undefined,
};

function getSyncPatientHandler(ehr: EhrSource): SyncPatientFn {
  const handler = syncPatientMethodsBy[ehr];
  if (!handler) {
    throw new BadRequestError("Could not find handler to sync patient", undefined, {
      ehr,
    });
  }
  return handler;
}

async function getCxMappingWithoutPracticeId({ cxId, ehr }: { cxId: string; ehr: EhrSource }) {
  const cxMappings = await getCxMappingsByCustomer({ cxId, source: ehr });
  const cxMapping = cxMappings[0];
  if (!cxMapping) throw new MetriportError("CX mapping not found", undefined, { ehr, cxId });
  if (cxMappings.length > 1) {
    throw new MetriportError("Multiple CX mappings found", undefined, { ehr, cxId });
  }
  return cxMapping;
}

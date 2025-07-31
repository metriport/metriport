import { BadRequestError, NotFoundError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { CxMapping } from "../../../domain/cx-mapping";
import { syncElationPatientIntoMetriport } from "../../../external/ehr/elation/command/sync-patient";
import { syncHealthiePatientIntoMetriport } from "../../../external/ehr/healthie/command/sync-patient";
import { getCxMappingsByCustomer } from "../../mapping/cx";
import { getPatientOrFail } from "./get-patient";

export type MapPatientParams = {
  cxId: string;
  patientId: string;
  source?: EhrSource | undefined;
};

/**
 * Synchronizes a Metriport patient to a patient in an external system.
 *
 * @param cxId - The ID of the customer.
 * @param patientId - The ID of the patient to map.
 * @param source - The source of the mapping. Optional. Required if the organization has multiple mappings.
 * @returns The Metriport patient ID and the mapped system (external) patient ID.
 * @throws 400 if the patient has no external ID to attempt mapping.
 * @throws 400 if the mapping source is not supported.
 * @throws 404 if no mapping is found.
 * @throws 404 if patient demographics are not matching.
 */
export async function forceEhrPatientSync({
  cxId,
  patientId,
  source,
}: MapPatientParams): Promise<{ metriportPatientId: string; externalId: string }> {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (!patient.externalId) {
    throw new BadRequestError("Patient has no external ID to attempt syncing", undefined, {
      cxId,
      patientId,
    });
  }
  const cxMapping = await getCxMapping({
    cxId,
    patientId,
    source,
  });

  if (cxMapping.source === EhrSources.elation) {
    const metriportPatientId = await syncElationPatientIntoMetriport({
      cxId,
      elationPatientId: patient.externalId,
      elationPracticeId: cxMapping.externalId,
      inputMetriportPatientId: patientId,
      triggerDqForExistingPatient: true,
      triggerDq: true,
    });
    return { metriportPatientId, externalId: patient.externalId };
  } else if (cxMapping.source === EhrSources.healthie) {
    const metriportPatientId = await syncHealthiePatientIntoMetriport({
      cxId,
      healthiePatientId: patient.externalId,
      healthiePracticeId: cxMapping.externalId,
      inputMetriportPatientId: patientId,
      triggerDqForExistingPatient: true,
      triggerDq: true,
    });
    return { metriportPatientId, externalId: patient.externalId };
  }
  throw new BadRequestError("Unsupported mapping source", undefined, {
    cxId,
    patientId,
    source,
  });
}

async function getCxMapping({
  cxId,
  patientId,
  source,
}: {
  cxId: string;
  patientId: string;
  source?: EhrSource | undefined;
}): Promise<CxMapping> {
  const cxMappings = await getCxMappingsByCustomer({ cxId, source });
  const cxMapping = cxMappings[0];
  if (!cxMapping) {
    throw new NotFoundError("No integration mapping found", undefined, { cxId, patientId, source });
  }
  if (cxMappings.length > 1) {
    throw new BadRequestError(
      "Multiple source integrations found. Please specify a source",
      undefined,
      { cxId, patientId, source }
    );
  }
  return cxMapping;
}

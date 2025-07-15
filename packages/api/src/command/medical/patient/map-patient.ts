import { Patient, PatientData } from "@metriport/core/domain/patient";
import { BadRequestError, NotFoundError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr";
import { CxMapping } from "../../../domain/cx-mapping";
import { syncElationPatientIntoMetriport } from "../../../external/ehr/elation/command/sync-patient";
import { syncHealthiePatientIntoMetriport } from "../../../external/ehr/healthie/command/sync-patient";
import { getCxMappingByIdOrFail, getCxMappingsByCustomer } from "../../mapping/cx";
import { getPatientOrFail } from "./get-patient";

type Identifier = Pick<Patient, "cxId" | "externalId"> & { facilityId: string };
type PatientNoExternalData = Omit<PatientData, "externalData">;
export type PatientCreateCmd = PatientNoExternalData & Identifier;

export async function mapPatient({
  cxId,
  patientId,
  cxMappingId,
}: {
  cxId: string;
  patientId: string;
  cxMappingId?: string;
}): Promise<{ metriportPatientId: string; mappingPatientId: string }> {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  if (!patient.externalId) {
    throw new BadRequestError("Patient has no external ID to attempt mapping", undefined, {
      cxId,
      patientId,
    });
  }
  const cxMapping = cxMappingId
    ? await getCxMappingByIdOrFail({ id: cxMappingId, cxId })
    : await getCxMapping(cxId, patientId);
  if (cxMapping.source === EhrSources.elation) {
    const metriportPatientId = await syncElationPatientIntoMetriport({
      cxId,
      elationPatientId: patient.externalId,
      elationPracticeId: cxMapping.externalId,
    });
    return { metriportPatientId, mappingPatientId: patient.externalId };
  } else if (cxMapping.source === EhrSources.healthie) {
    const metriportPatientId = await syncHealthiePatientIntoMetriport({
      cxId,
      healthiePatientId: patient.externalId,
      healthiePracticeId: cxMapping.externalId,
    });
    return { metriportPatientId, mappingPatientId: patient.externalId };
  }
  throw new BadRequestError("Unsupported mapping source", undefined, {
    cxId,
    patientId,
    cxMappingId,
    source: cxMapping.source,
  });
}

async function getCxMapping(cxId: string, patientId: string): Promise<CxMapping> {
  const cxMappings = await getCxMappingsByCustomer({ cxId });
  const cxMapping = cxMappings[0];
  if (!cxMapping) {
    throw new NotFoundError("No integrationmapping found", undefined, { cxId, patientId });
  }
  if (cxMappings.length > 1) {
    throw new BadRequestError(
      "Multiple integration mappings found. Please specify a mapping ID",
      undefined,
      { cxId, patientId }
    );
  }
  return cxMapping;
}

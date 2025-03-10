import { PatientDemoData } from "@metriport/core/domain/patient";
import { EhrSource } from "@metriport/core/external/shared/ehr";
import { getFacilityMapping, getFacilityMappingOrFail } from "../../command/mapping/facility";
import { createPatient } from "../../command/medical/patient/create-patient";
import { PatientWithIdentifiers } from "../../command/medical/patient/get-patient";

export type HandleMetriportSyncParams = {
  cxId: string;
  source: EhrSource;
  practiceId: string;
  demographics: PatientDemoData;
  externalId: string;
};

export async function handleMetriportSync({
  cxId,
  source,
  practiceId,
  demographics,
  externalId,
}: HandleMetriportSyncParams): Promise<PatientWithIdentifiers> {
  const state = demographics.address?.[0]?.state;
  const facilityId = await getFacilityId({
    cxId,
    source,
    practiceId,
    state,
  });
  return await createPatient({
    patient: {
      cxId,
      facilityId,
      externalId,
      ...demographics,
    },
  });
}

async function getFacilityId({
  cxId,
  source,
  practiceId,
  state,
}: {
  cxId: string;
  source: EhrSource;
  practiceId: string;
  state?: string;
}): Promise<string> {
  if (state) {
    const stateFacilityId = await getFacilityMapping({
      cxId,
      externalId: createFacilityStateExternalId(practiceId, state),
      source,
    });
    if (stateFacilityId) return stateFacilityId.facilityId;
  }
  const facilityMapping = await getFacilityMappingOrFail({
    cxId,
    externalId: practiceId,
    source,
  });
  return facilityMapping.facilityId;
}

function createFacilityStateExternalId(practiceId: string, state: string): string {
  return `${practiceId}-${state}`;
}

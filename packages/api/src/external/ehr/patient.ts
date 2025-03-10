import { PatientDemoData } from "@metriport/core/domain/patient";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { getFacilityMapping, getFacilityMappingOrFail } from "../../command/mapping/facility";
import { createPatient } from "../../command/medical/patient/create-patient";
import { PatientWithIdentifiers } from "../../command/medical/patient/get-patient";
import { EhrSource } from "./shared";

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
  if (!state) {
    throw new MetriportError("No state found for patient", undefined, {
      cxId,
      source,
      practiceId,
      externalId,
    });
  }
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
  state: string;
}): Promise<string> {
  const stateFacilityId = await getFacilityMapping({
    cxId,
    externalId: createFacilityStateExternalId(practiceId, state),
    source,
  });
  if (stateFacilityId) return stateFacilityId.facilityId;
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

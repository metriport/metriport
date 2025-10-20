import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import { buildDayjs } from "@metriport/shared/common/date";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { getFacilityMapping, getFacilityMappingOrFail } from "../../../../command/mapping/facility";
import { createPatient } from "../../../../command/medical/patient/create-patient";
import { PatientWithIdentifiers } from "../../../../command/medical/patient/get-patient";

dayjs.extend(duration);

const patientDqCooldown = dayjs.duration(1, "days");

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

export function isDqCooldownExpired(patient: Patient): boolean {
  const lastDqStartedAt = patient.data.documentQueryProgress?.startedAt;
  if (!lastDqStartedAt) return true;
  const lastStartedAt = buildDayjs(lastDqStartedAt);
  const diff = buildDayjs().diff(lastStartedAt, "hours");
  if (diff > patientDqCooldown.asHours()) {
    return true;
  } else {
    return false;
  }
}

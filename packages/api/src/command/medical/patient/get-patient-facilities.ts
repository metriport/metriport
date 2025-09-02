import { MetriportError } from "../../../../../shared/dist";
import { Facility } from "../../../domain/medical/facility";
import { getFacilities } from "../facility/get-facility";
import { getPatientOrFail } from "./get-patient";

export type GetPatientFacilitiesCmd = {
  cxId: string;
  patientId: string;
};

export async function getPatientFacilities({
  cxId,
  patientId,
}: GetPatientFacilitiesCmd): Promise<Facility[]> {
  const patient = await getPatientOrFail({
    id: patientId,
    cxId,
  });

  if (!patient.facilityIds || patient.facilityIds.length === 0) {
    return [];
  }

  const facilities = await getFacilities({
    cxId,
    ids: patient.facilityIds,
  });

  return facilities;
}

export async function getPatientPrimaryFacilityIdOrFail({
  cxId,
  patientId,
}: GetPatientFacilitiesCmd): Promise<string> {
  const patient = await getPatientOrFail({ id: patientId, cxId });
  const facilityIds = patient.facilityIds;
  if (facilityIds.length < 1) {
    throw new MetriportError("Patient has no facilities", undefined, {
      patientId,
      cxId,
    });
  }
  return facilityIds[0];
}

import { Facility } from "../../../domain/medical/facility";
import { getPatientOrFail } from "./get-patient";
import { getFacilities } from "../facility/get-facility";
import { BadRequestError } from "../../../../../shared/dist";

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
  const facilities = await getPatientFacilities({ cxId, patientId });
  if (!facilities.length) {
    throw new BadRequestError("Patient has no facilities");
  }
  return facilities[0].id;
}

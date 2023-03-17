import NotFoundError from "../../../errors/not-found";
import { Facility } from "../../../models/medical/facility";
import { Organization } from "../../../models/medical/organization";
import { Patient } from "../../../models/medical/patient";
import { getFacilities } from "../facility/get-facility";
import { getOrganizationOrFail } from "../organization/get-organization";

export const getPatients = async ({
  facilityId,
  cxId,
}: {
  facilityId: string;
  cxId: string;
}): Promise<Patient[]> => {
  const patients = await Patient.findAll({
    where: { cxId, facilityIds: [facilityId] },
  });
  return patients;
};

export const getPatient = async ({ id, cxId }: { id: string; cxId: string }): Promise<Patient> => {
  const patient = await Patient.findOne({
    where: { cxId, id },
  });
  if (!patient) {
    throw new NotFoundError(`Could not find patient with id: ${id} and cxId: ${cxId}`);
  }
  return patient;
};

export const getPatientWithDependencies = async ({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<{ patient: Patient; facilities: Facility[]; organization: Organization }> => {
  const patient = await getPatient({ id, cxId });
  const facilities = await getFacilities({ cxId, ids: patient.facilityIds });
  const organization = await getOrganizationOrFail({ cxId });
  return { patient, facilities, organization };
};

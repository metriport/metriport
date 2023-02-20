import { Patient } from "../../../models/medical/patient";

export const createPatient = async ({
  organizationId,
  facilityId,
  cxId,
  data,
}: {
  organizationId: number;
  facilityId: number;
  cxId: string;
  data: object;
}): Promise<Patient> => {
  const patient = await Patient.create({
    id: "", // this will be generated on the beforeCreate hook
    cxId,
    facilityIds: [facilityId],
    organizationId,
    patientId: 0, // this will be generated on the beforeCreate hook
    data,
  });
  return patient;
};

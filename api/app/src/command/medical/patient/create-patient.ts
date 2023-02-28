import { Patient } from "../../../models/medical/patient";

export const createPatient = async ({
  facilityId,
  cxId,
  data,
}: {
  facilityId: string;
  cxId: string;
  data: object;
}): Promise<Patient> => {
  return Patient.create({
    id: "", // the patient id will be generated on the beforeCreate hook
    cxId,
    facilityIds: [facilityId],
    patientNumber: 0, // this will be generated on the beforeCreate hook
    data,
  });
};

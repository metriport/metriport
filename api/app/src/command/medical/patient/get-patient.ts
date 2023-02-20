import { Patient } from "../../../models/medical/patient";

export const getPatients = async ({
  facilityId,
  cxId,
}: {
  facilityId: number;
  cxId: string;
}): Promise<Patient[]> => {
  const patients = await Patient.findAll({
    where: { cxId, facilityIds: [facilityId] },
  });
  return patients;
};

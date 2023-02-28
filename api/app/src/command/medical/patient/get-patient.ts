import NotFoundError from "../../../errors/not-found";
import { Patient } from "../../../models/medical/patient";

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

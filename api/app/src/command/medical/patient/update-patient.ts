import BadRequestError from "../../../errors/bad-request";
import { Patient } from "../../../models/medical/patient";

export const updatePatient = async ({
  id,
  facilityId,
  cxId,
  data,
}: {
  id: string;
  facilityId: string;
  cxId: string;
  data: object;
}): Promise<Patient> => {
  const [count, rows] = await Patient.update(
    {
      data,
    },
    { where: { id, facilityIds: [facilityId], cxId }, returning: true }
  );
  if (count != 1)
    throw new BadRequestError(
      `Expected a single patient to be updated, but ${count} were updated for id: ${id} and cxId: ${cxId} and facilityId: ${facilityId}`
    );
  return rows[0];
};

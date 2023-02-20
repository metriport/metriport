import BadRequestError from "../../../errors/bad-request";
import { Patient } from "../../../models/medical/patient";

export const updatePatient = async ({
  id,
  organizationId,
  facilityId,
  cxId,
  data,
}: {
  id: string;
  organizationId: number;
  facilityId: number;
  cxId: string;
  data: object;
}): Promise<Patient> => {
  const [count, rows] = await Patient.update(
    {
      data,
    },
    { where: { id, organizationId, facilityIds: [facilityId], cxId }, returning: true }
  );
  if (count != 1)
    throw new BadRequestError(
      `More than one facility found for id: ${id} and cxId: ${cxId} and organizationId: ${organizationId} and facilityId: ${facilityId}`
    );
  return rows[0];
};

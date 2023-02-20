import BadRequestError from "../../../errors/bad-request";
import { Facility } from "../../../models/medical/facility";

export const updateFacility = async ({
  id,
  organizationId,
  cxId,
  data,
}: {
  id: string;
  organizationId: number;
  cxId: string;
  data: object;
}): Promise<Facility> => {
  const [count, rows] = await Facility.update(
    {
      data,
    },
    { where: { id, organizationId, cxId }, returning: true }
  );
  if (count != 1)
    throw new BadRequestError(
      `More than one facility found for id: ${id} and cxId: ${cxId} and organizationId: ${organizationId}`
    );
  return rows[0];
};

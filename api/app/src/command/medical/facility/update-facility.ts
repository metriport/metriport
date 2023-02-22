import BadRequestError from "../../../errors/bad-request";
import { Facility } from "../../../models/medical/facility";

export const updateFacility = async ({
  id,
  cxId,
  data,
}: {
  id: string;
  cxId: string;
  data: object;
}): Promise<Facility> => {
  const [count, rows] = await Facility.update(
    {
      data,
    },
    { where: { id, cxId }, returning: true }
  );
  if (count != 1)
    throw new BadRequestError(
      `Expected a single facility to be updated, but ${count} were updated for id: ${id} and cxId: ${cxId}`
    );
  return rows[0];
};

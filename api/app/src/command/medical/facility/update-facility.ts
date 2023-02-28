import NotFoundError from "../../../errors/not-found";
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
  if (count < 1) throw new NotFoundError();
  // TODO #156 Send this to Sentry
  if (count > 1) console.error(`Updated ${count} facilities for id ${id} and cxId ${cxId}`);
  return rows[0];
};

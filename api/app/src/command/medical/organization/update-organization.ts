import BadRequestError from "../../../errors/bad-request";
import { Organization } from "../../../models/medical/organization";

export const updateOrganization = async ({
  id,
  cxId,
  data,
}: {
  id: string;
  cxId: string;
  data: object;
}): Promise<Organization> => {
  const [count, rows] = await Organization.update(
    {
      data,
    },
    { where: { id, cxId }, returning: true }
  );
  if (count != 1)
    throw new BadRequestError(
      `Expected a single org to be updated, but ${count} were updated for id: ${id} and cxId: ${cxId}`
    );
  return rows[0];
};

import { Organization, OrganizationData } from "../../../models/medical/organization";
import NotFoundError from "../../../errors/not-found";

export const updateOrganization = async ({
  id,
  cxId,
  data,
}: {
  id: string;
  cxId: string;
  data: OrganizationData;
}): Promise<Organization> => {
  const [count, rows] = await Organization.update(
    {
      data,
    },
    { where: { id, cxId }, returning: true }
  );
  if (count < 1) throw new NotFoundError();
  // TODO #156 Send this to Sentry
  if (count > 1) console.error(`Updated ${count} Orgs for id ${id} and cxId ${cxId}`);
  return rows[0];
};

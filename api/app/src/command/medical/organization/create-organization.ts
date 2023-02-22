import { Organization } from "../../../models/medical/organization";

export const createOrganization = async ({
  cxId,
  data,
}: {
  cxId: string;
  data: object;
}): Promise<Organization> => {
  // ensure we never create more than one org per customer
  const [org] = await Organization.findOrCreate({
    where: { cxId },
    defaults: {
      id: "", // this will be generated on the beforeCreate hook
      cxId,
      organizationNumber: 0, // this will be generated on the beforeCreate hook
      data,
    },
  });
  return org;
};

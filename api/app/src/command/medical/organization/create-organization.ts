import BadRequestError from "../../../errors/bad-request";
import { Organization, OrganizationData } from "../../../models/medical/organization";
import { getOrganization } from "./get-organization";

type Identifier = Pick<Organization, "cxId">;
type OrganizationNoExternalData = Omit<OrganizationData, "externalData">;
export type OrganizationCreateCmd = OrganizationNoExternalData & Identifier;

export const createOrganization = async (org: OrganizationCreateCmd): Promise<Organization> => {
  const { cxId, name, type, location } = org;

  // ensure we never create more than one org per customer
  const existingOrg = await getOrganization({ cxId });
  if (existingOrg) throw new BadRequestError(`Organization already exists for customer ${cxId}`);

  return Organization.create({
    id: "", // this will be generated on the beforeCreate hook
    organizationNumber: 0, // this will be generated on the beforeCreate hook
    cxId,
    data: { name, type, location },
  });
};

import BadRequestError from "../../../errors/bad-request";
import { createTenantIfNotExists } from "../../../external/fhir/admin";
import { OrganizationData, OrganizationModel } from "../../../models/medical/organization";
import { createOrganizationId } from "../customer-sequence/create-id";
import { getOrganization } from "./get-organization";

type Identifier = Pick<OrganizationModel, "cxId">;
type OrganizationNoExternalData = Omit<OrganizationData, "externalData">;
export type OrganizationCreateCmd = OrganizationNoExternalData & Identifier;

export const createOrganization = async (
  orgData: OrganizationCreateCmd
): Promise<OrganizationModel> => {
  const { cxId, name, type, location } = orgData;

  // ensure we never create more than one org per customer
  const existingOrg = await getOrganization({ cxId });
  if (existingOrg) throw new BadRequestError(`Organization already exists for customer ${cxId}`);

  const { id, organizationNumber } = await createOrganizationId();

  const org = await OrganizationModel.create({
    id,
    organizationNumber,
    cxId,
    data: { name, type, location },
  });

  // create tenant on FHIR server
  await createTenantIfNotExists(org);

  return org;
};

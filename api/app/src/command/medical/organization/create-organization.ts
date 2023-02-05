import { Organization } from "../../../models/medical/organization";
import { Config } from "../../../shared/config";


export const createOrganization = async (): Promise<Organization> => {
  const org = await Organization.create({
    id: 0, // this will be generated on the beforeCreate hook
    systemRootOid: Config.getSystemRootOID(),
  });
  return org;
};

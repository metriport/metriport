import { Facility } from "../../../models/medical/facility";
import { Config } from "../../../shared/config";
import { OIDNode } from "../../../shared/oid";

export const createFacility = async ({
  organizationNumber,
  cxId,
  data,
}: {
  organizationNumber: number;
  cxId: string;
  data: object;
}): Promise<Facility> => {
  const facility = await Facility.create({
    id: `${Config.getSystemRootOID()}.${OIDNode.organizations}.${organizationNumber}.${
      OIDNode.locations
    }.`, // the facility number will be generated on the beforeCreate hook
    cxId,
    facilityNumber: 0, // this will be generated on the beforeCreate hook
    data,
  });
  return facility;
};

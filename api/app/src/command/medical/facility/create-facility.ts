import { Facility } from "../../../models/medical/facility";
import { Config } from "../../../shared/config";

export const createFacility = async ({
  organizationId,
}: {
  organizationId: number;
}): Promise<Facility> => {
  const facility = await Facility.create({
    id: 0, // this will be generated on the beforeCreate hook
    systemRootOid: Config.getSystemRootOID(),
    organizationId: organizationId,
  });
  return facility;
};

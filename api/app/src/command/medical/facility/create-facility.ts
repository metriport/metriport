import { Facility } from "../../../models/medical/facility";

export const createFacility = async ({
  organizationId,
  cxId,
  data,
}: {
  organizationId: number;
  cxId: string;
  data: object;
}): Promise<Facility> => {
  const facility = await Facility.create({
    id: "", // this will be generated on the beforeCreate hook
    cxId,
    facilityId: 0, // this will be generated on the beforeCreate hook
    organizationId,
    data,
  });
  return facility;
};

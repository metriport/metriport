import { Facility } from "../../../models/medical/facility";

export const createFacility = async ({
  cxId,
  data,
}: {
  cxId: string;
  data: object;
}): Promise<Facility> => {
  const facility = await Facility.create({
    id: "", // the facility id will be generated on the beforeCreate hook
    cxId,
    facilityNumber: 0, // this will be generated on the beforeCreate hook
    data,
  });
  return facility;
};

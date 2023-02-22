import { Facility } from "../../../models/medical/facility";

export const getFacilities = async ({ cxId }: { cxId: string }): Promise<Facility[]> => {
  const facility = await Facility.findAll({
    where: { cxId },
  });
  return facility;
};

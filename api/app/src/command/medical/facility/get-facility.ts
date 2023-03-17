import { Facility } from "../../../models/medical/facility";

type GetFacilitiesQuery = Pick<Facility, "cxId"> & Partial<{ ids: Facility["id"][] }>;

export const getFacilities = async ({ cxId, ids }: GetFacilitiesQuery): Promise<Facility[]> => {
  const facility = await Facility.findAll({
    where: {
      ...(ids ? { id: ids } : undefined),
      cxId,
    },
  });
  return facility;
};

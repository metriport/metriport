import { Facility } from "../../../models/medical/facility";

export const getFacilities = async ({
  organizationId,
  cxId,
}: {
  organizationId: number;
  cxId: string;
}): Promise<Facility[]> => {
  const facility = await Facility.findAll({
    where: { cxId, organizationId },
  });
  return facility;
};

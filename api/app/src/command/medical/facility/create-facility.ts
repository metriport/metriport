import { FacilityData, FacilityModel } from "../../../models/medical/facility";
import { createFacilityId } from "../customer-sequence/create-id";

export const createFacility = async ({
  cxId,
  data,
}: {
  cxId: string;
  data: FacilityData;
}): Promise<FacilityModel> => {
  const { id, facilityNumber } = await createFacilityId(cxId);
  return FacilityModel.create({
    id,
    facilityNumber,
    cxId,
    data,
  });
};

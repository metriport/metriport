import { FacilityData, FacilityModel } from "../../../models/medical/facility";
import { uuidv7 } from "../../../shared/uuid-v7";

export const createFacility = async ({
  cxId,
  data,
}: {
  cxId: string;
  data: FacilityData;
}): Promise<FacilityModel> => {
  return FacilityModel.create({
    id: uuidv7(),
    cxId,
    data,
  });
};

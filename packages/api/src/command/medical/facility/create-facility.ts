import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { FacilityData } from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";

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

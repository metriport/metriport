import { FacilityData, FacilityModel } from "../../../models/medical/facility";

export const createFacility = async ({
  cxId,
  data,
}: {
  cxId: string;
  data: FacilityData;
}): Promise<FacilityModel> => {
  return FacilityModel.create({
    id: "", // the facility id will be generated on the beforeCreate hook
    facilityNumber: 0, // this will be generated on the beforeCreate hook
    cxId,
    data,
  });
};

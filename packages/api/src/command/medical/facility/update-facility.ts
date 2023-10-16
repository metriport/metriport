import { FacilityData } from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getFacilityOrFail } from "./get-facility";

export type FacilityUpdateCmd = BaseUpdateCmdWithCustomer & FacilityData;

export const updateFacility = async (facilityUpdate: FacilityUpdateCmd): Promise<FacilityModel> => {
  const { id, cxId, eTag, name, npi, tin, active, address } = facilityUpdate;

  const facility = await getFacilityOrFail({ id, cxId });
  validateVersionForUpdate(facility, eTag);

  return facility.update({
    data: {
      name,
      npi,
      tin,
      active,
      address,
    },
  });
};

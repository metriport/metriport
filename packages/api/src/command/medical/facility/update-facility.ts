import { FacilityUpdate } from "../../../domain/medical/facility";
import { validateVersionForUpdate } from "../../../models/_default";
import { FacilityModel } from "../../../models/medical/facility";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getFacilityOrFail } from "./get-facility";

export type FacilityUpdateCmd = BaseUpdateCmdWithCustomer & FacilityUpdate;

export const updateFacility = async (facilityUpdate: FacilityUpdateCmd): Promise<FacilityModel> => {
  const { id, cxId, eTag, data, cqOboActive, cwOboActive, cqOboOid, cwOboOid } = facilityUpdate;
  const { name, npi, tin, active, address } = data;

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
    cqOboActive: cqOboActive ?? false,
    cwOboActive: cwOboActive ?? false,
    cqOboOid,
    cwOboOid,
  });
};

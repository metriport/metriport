import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { FacilityType } from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";
import { FacilityCreate } from "../../../domain/medical/facility";

export const createFacility = async ({
  cxId,
  data,
  type = FacilityType.initiatorAndResponder,
  cqOboActive = false,
  cwOboActive = false,
  cqOboOid,
  cwOboOid,
}: FacilityCreate): Promise<FacilityModel> => {
  return FacilityModel.create({
    id: uuidv7(),
    cxId,
    type,
    oid: "", // will be set when facility is created in hook
    facilityNumber: 0, // will be set when facility is created in hook
    cqOboActive,
    cwOboActive,
    cqOboOid,
    cwOboOid,
    data,
  });
};

import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { FacilityData, FacilityType } from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";

export const createFacility = async ({
  cxId,
  data,
  type = FacilityType.initiatorAndResponder,
  cqOboActive = false,
  cwOboActive = false,
  cqOboOid,
  cwOboOid,
}: {
  cxId: string;
  data: FacilityData;
  type?: FacilityType;
  cqOboActive?: boolean;
  cwOboActive?: boolean;
  cqOboOid?: string;
  cwOboOid?: string;
}): Promise<FacilityModel> => {
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

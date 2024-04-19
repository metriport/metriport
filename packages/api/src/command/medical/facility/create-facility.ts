import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { FacilityData } from "../../../domain/medical/facility";
import { FacilityModel, FacilityType } from "../../../models/medical/facility";

export const createFacility = async ({
  cxId,
  data,
  type = FacilityType.initiatorAndResponder,
  cqOBOActive = false,
  cwOBOActive = false,
  cqOboOid,
  cwOboOid,
}: {
  cxId: string;
  data: FacilityData;
  type?: FacilityType;
  cqOBOActive?: boolean;
  cwOBOActive?: boolean;
  cqOboOid?: string;
  cwOboOid?: string;
}): Promise<FacilityModel> => {
  return FacilityModel.create({
    id: uuidv7(),
    cxId,
    type,
    oid: "", // will be set when facility is created in hook
    facilityNumber: 0, // will be set when facility is created in hook
    cqOBOActive,
    cwOBOActive,
    cqOboOid,
    cwOboOid,
    data,
  });
};

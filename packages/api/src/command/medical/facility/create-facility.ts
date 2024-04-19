import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { FacilityData } from "../../../domain/medical/facility";
import { FacilityModel, FacilityType } from "../../../models/medical/facility";

export const createFacility = async ({
  cxId,
  data,
  type = FacilityType.initiatorAndResponder,
  cqOBOActive = false,
  cwOBOActive = false,
  cqOBOOID = "",
  cwOBOOID = "",
}: {
  cxId: string;
  data: FacilityData;
  type: FacilityType;
  cqOBOActive: boolean;
  cwOBOActive: boolean;
  cqOBOOID: string;
  cwOBOOID: string;
}): Promise<FacilityModel> => {
  return FacilityModel.create({
    id: uuidv7(),
    cxId,
    type,
    oid: "", // will be set when facility is created in hook
    facilityNumber: 0, // will be set when facility is created in hook
    cqOBOActive,
    cwOBOActive,
    cqOBOOID,
    cwOBOOID,
    data,
  });
};

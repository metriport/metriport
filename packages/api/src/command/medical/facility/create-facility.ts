import BadRequestError from "@metriport/core/util/error/bad-request";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  Facility,
  FacilityCreate,
  FacilityType,
  isOboFacility,
} from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";

export const createFacility = async ({
  cxId,
  data,
  cqActive = false,
  cqType = FacilityType.initiatorAndResponder,
  cqOboOid,
  cwActive = false,
  cwType = FacilityType.initiatorAndResponder,
  cwOboOid,
}: FacilityCreate): Promise<Facility> => {
  const input = {
    id: uuidv7(),
    oid: "", // will be set when facility is created in hook
    facilityNumber: 0, // will be set when facility is created in hook
    cxId,
    cqType,
    cwType,
    cqActive,
    cwActive,
    cqOboOid: cqOboOid ?? null,
    cwOboOid: cwOboOid ?? null,
    data,
  };
  validateCreate(input);
  return FacilityModel.create(input);
};

export function validateCreate(facility: FacilityCreate, throwOnError = true): boolean {
  const { cwType, cqType, cqActive, cwActive, cqOboOid, cwOboOid } = facility;
  if (isOboFacility(cwType) && cwActive && !cwOboOid) {
    if (!throwOnError) return false;
    throw new BadRequestError("CW OBO facility must have CW OBO OID when CW OBO active");
  }

  if (isOboFacility(cqType) && cqActive && !cqOboOid) {
    if (!throwOnError) return false;
    throw new BadRequestError("CQ OBO facility must have CQ OBO OID when CQ OBO active");
  }

  return true;
}

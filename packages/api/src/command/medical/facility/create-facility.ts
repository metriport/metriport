import BadRequestError from "@metriport/core/util/error/bad-request";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  Facility,
  FacilityCreate,
  FacilityType,
  isNonOboFacility,
} from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";

export const createFacility = async ({
  cxId,
  data,
  cqOboActive = false,
  cqType = FacilityType.initiatorAndResponder,
  cqOboOid,
  cwOboActive = false,
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
    cqOboActive,
    cwOboActive,
    cqOboOid: cqOboOid ?? null,
    cwOboOid: cwOboOid ?? null,
    data,
  };
  validateCreate(input);
  return FacilityModel.create(input);
};

export function validateCreate(facility: FacilityCreate, throwOnError = true): boolean {
  const { cwType, cqType, cqOboActive, cwOboActive, cqOboOid, cwOboOid } = facility;
  if (isNonOboFacility(cwType) && cwOboActive) {
    if (!throwOnError) return false;
    throw new BadRequestError("CW Non-OBO facility cannot have OBO active");
  }
  if (cwOboActive && !cwOboOid) {
    if (!throwOnError) return false;
    throw new BadRequestError("Facility must have CW OBO OID when CW OBO active");
  }

  if (isNonOboFacility(cqType) && cqOboActive) {
    if (!throwOnError) return false;
    throw new BadRequestError("CQ Non-OBO facility cannot have OBO active");
  }
  if (cqOboActive && !cqOboOid) {
    if (!throwOnError) return false;
    throw new BadRequestError("Facility must have CQ OBO OID when CQ OBO active");
  }

  return true;
}

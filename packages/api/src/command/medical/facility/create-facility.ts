import BadRequestError from "@metriport/core/util/error/bad-request";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  FacilityCreate,
  FacilityData,
  FacilityType,
  isOboFacility,
  Facility,
} from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";

export type FacilityCreateCmd = {
  cxId: string;
  data: FacilityData;
  type?: FacilityType;
  cqOboActive?: boolean;
  cwOboActive?: boolean;
  cqOboOid?: string;
  cwOboOid?: string;
};

export const createFacility = async ({
  cxId,
  data,
  type = FacilityType.initiatorAndResponder,
  cqOboActive = false,
  cwOboActive = false,
  cqOboOid,
  cwOboOid,
}: FacilityCreateCmd): Promise<Facility> => {
  const input: FacilityCreate = {
    id: uuidv7(),
    oid: "", // will be set when facility is created in hook
    facilityNumber: 0, // will be set when facility is created in hook
    cxId,
    type,
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
  const { type, cqOboActive, cwOboActive, cqOboOid, cwOboOid } = facility;

  if (isOboFacility(type) && !cqOboActive && !cwOboActive) {
    if (!throwOnError) return false;
    throw new BadRequestError("OBO facility must have at least one OBO active");
  }
  if (!isOboFacility(type) && (cqOboActive || cwOboActive)) {
    if (!throwOnError) return false;
    throw new BadRequestError("Non-OBO facility cannot have OBO active");
  }

  if (cqOboActive && !cqOboOid) {
    if (!throwOnError) return false;
    throw new BadRequestError("Facility must have CQ OBO OID when CQ OBO active");
  }
  if (cwOboActive && !cwOboOid) {
    if (!throwOnError) return false;
    throw new BadRequestError("Facility must have CW OBO OID when CW OBO active");
  }

  return true;
}

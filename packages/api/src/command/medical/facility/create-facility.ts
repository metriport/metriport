import { BadRequestError } from "@metriport/shared/error/bad-request";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { FacilityCreate, FacilityType, isOboFacility } from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";
import { getFacilityByNpi } from "./get-facility";

export async function createFacility({
  cxId,
  data,
  cqApproved = false,
  cqActive = false,
  cqType = FacilityType.initiatorAndResponder,
  cqOboOid,
  cwApproved = false,
  cwActive = false,
  cwType = FacilityType.initiatorAndResponder,
  cwOboOid,
}: FacilityCreate): Promise<FacilityModel> {
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
    cqApproved,
    cwApproved,
  };
  validateObo(input);
  await validateNPI(cxId, input.data.npi);
  return await FacilityModel.create(input);
}

export async function validateNPI(cxId: string, newNpi: string, existingNpi?: string) {
  if (existingNpi && newNpi !== existingNpi) {
    throw new BadRequestError(`Can't update NPI`);
  }
  if (!existingNpi) {
    const facilityByNpi = await getFacilityByNpi({ cxId, npi: newNpi });
    if (facilityByNpi) {
      throw new BadRequestError(
        `Can't create a new facility with the same NPI as facility with ID: ${facilityByNpi.id} and name: ${facilityByNpi.data.name}`
      );
    }
  }
}

export function validateObo(facility: FacilityCreate, throwOnError = true): boolean {
  const { cwType, cqType, cqOboOid, cwOboOid } = facility;
  if (isOboFacility(cwType) && !cwOboOid) {
    if (!throwOnError) return false;
    throw new BadRequestError("CW OBO facility must have CW OBO OID");
  }

  if (isOboFacility(cqType) && !cqOboOid) {
    if (!throwOnError) return false;
    throw new BadRequestError("CQ OBO facility must have CQ OBO OID");
  }

  return true;
}

import { validateDelegateFacility } from "@metriport/core/domain/facility";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { FacilityCreate } from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";
import { getFacilityByNpi } from "./get-facility";

export async function createFacility({
  cxId,
  data,
  cqApproved = false,
  cqActive = false,
  cwApproved = false,
  cwActive = false,
  ehexApproved = false,
  ehexActive = false,
  type,
  principalOid,
}: FacilityCreate): Promise<FacilityModel> {
  const input = {
    id: uuidv7(),
    oid: "", // will be set when facility is created in hook
    facilityNumber: 0, // will be set when facility is created in hook
    cxId,
    type,
    cqActive,
    cwActive,
    ehexActive,
    principalOid: principalOid ?? null,
    data,
    cqApproved,
    cwApproved,
    ehexApproved,
  };
  validateDelegateFacility({
    type: input.type,
    principalOid: input.principalOid,
  });
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

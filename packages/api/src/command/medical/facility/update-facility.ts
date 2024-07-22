import { FacilityCreate } from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { validateObo, validateNPI } from "./create-facility";
import { getFacilityOrFail } from "./get-facility";

export type FacilityUpdateCmd = BaseUpdateCmdWithCustomer &
  Partial<Omit<FacilityCreate, "cwType" | "cqType">>;

export async function updateFacility({
  id,
  eTag,
  cxId,
  data,
  cqApproved,
  cqActive,
  cqOboOid,
  cwApproved,
  cwActive,
  cwOboOid,
}: FacilityUpdateCmd): Promise<FacilityModel> {
  const facility = await getFacilityOrFail({ id, cxId });
  validateVersionForUpdate(facility, eTag);
  validateObo({
    ...facility,
    cqOboOid,
    cwOboOid,
  });
  if (data) await validateNPI(cxId, data.npi, facility.data.npi);

  return facility.update({
    data,
    cqActive,
    cwActive,
    cqOboOid,
    cwOboOid,
    cqApproved,
    cwApproved,
  });
}

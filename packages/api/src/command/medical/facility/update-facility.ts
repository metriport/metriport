import { validateDelegateFacility } from "@metriport/core/domain/facility";
import { FacilityCreate } from "../../../domain/medical/facility";
import { validateVersionForUpdate } from "../../../models/_default";
import { FacilityModel } from "../../../models/medical/facility";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { validateNPI } from "./create-facility";
import { getFacilityOrFail } from "./get-facility";

export type FacilityUpdateCmd = BaseUpdateCmdWithCustomer & Partial<FacilityCreate>;

export async function updateFacility({
  id,
  eTag,
  cxId,
  data,
  cqApproved,
  cqActive,
  cwApproved,
  cwActive,
  ehexApproved,
  ehexActive,
  type,
  principalOid,
}: FacilityUpdateCmd): Promise<FacilityModel> {
  const facility = await getFacilityOrFail({ id, cxId });
  validateVersionForUpdate(facility, eTag);

  const newType = type ?? facility.type;
  const newPrincipalOid = principalOid === undefined ? facility.principalOid : principalOid;

  validateDelegateFacility({
    type: newType,
    principalOid: newPrincipalOid,
  });
  if (data) await validateNPI(cxId, data.npi, facility.data.npi);

  return await facility.update({
    data,
    cqActive,
    cwActive,
    ehexActive,
    type: newType,
    principalOid: newPrincipalOid,
    cqApproved,
    cwApproved,
    ehexApproved,
  });
}

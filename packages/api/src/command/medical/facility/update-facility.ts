import { FacilityCreate } from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { validateObo, validateNPI } from "./create-facility";
import { getFacilityOrFail } from "./get-facility";

export type FacilityUpdateCmd = BaseUpdateCmdWithCustomer & Partial<FacilityCreate>;

export async function updateFacility({
  id,
  eTag,
  cxId,
  data,
  cqApproved,
  cqActive,
  cqType,
  cqOboOid,
  cwApproved,
  cwActive,
  cwType,
  cwOboOid,
}: FacilityUpdateCmd): Promise<FacilityModel> {
  const facility = await getFacilityOrFail({ id, cxId });
  validateVersionForUpdate(facility, eTag);
  validateObo({
    ...facility,
    cqType: cqType !== undefined ? cqType : facility.cqType,
    cwType: cwType !== undefined ? cwType : facility.cwType,
    cqOboOid: cqOboOid !== undefined ? cqOboOid : facility.cqOboOid,
    cwOboOid: cwOboOid !== undefined ? cwOboOid : facility.cwOboOid,
  });
  if (data) await validateNPI(cxId, data.npi, facility.data.npi);

  return await facility.update({
    data,
    cqActive,
    cwActive,
    cqType,
    cwType,
    cqOboOid,
    cwOboOid,
    cqApproved,
    cwApproved,
  });
}

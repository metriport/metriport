import { getFacilityOrFail } from "../../../command/medical/facility/get-facility";
import { Facility, FacilityRegister } from "../../../domain/medical/facility";
import { registerFacilityWithinHIEs } from "./register-facility";

/**
 * Creates or updates a facility within HIEs based on existing data from the DB.
 *
 * @param cxId
 * @param facilityId
 * @returns The updated facility.
 */
export async function syncFacilityWithinHIEs(cxId: string, facilityId: string): Promise<Facility> {
  const facility = await getFacilityOrFail({ cxId, id: facilityId });
  const { data } = facility;

  const facilityUpdate: FacilityRegister = {
    id: facility.id,
    cxId,
    cqActive: facility.cqActive,
    cqType: facility.cqType,
    cqOboOid: facility.cqOboOid,
    cwActive: facility.cwActive,
    cwType: facility.cwType,
    cwOboOid: facility.cwOboOid,
    // TODO #1838 Add this once we have this column on the DB
    // cwFacilityName: facility.cwFacilityName,
    data: {
      name: data.name,
      npi: data.npi,
      address: {
        addressLine1: data.address.addressLine1,
        city: data.address.city,
        state: data.address.state,
        zip: data.address.zip,
        country: data.address.country,
      },
    },
  };

  return await registerFacilityWithinHIEs(cxId, facilityUpdate);
}

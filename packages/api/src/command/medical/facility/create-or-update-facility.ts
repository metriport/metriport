import { FacilityCreate, Facility } from "../../../domain/medical/facility";
import { getFacilityStrictOrFail } from "./get-facility";
import { createFacility } from "./create-facility";
import { updateFacility } from "./update-facility";

export async function createOrUpdateFacility(
  cxId: string,
  facilityId: string | undefined,
  facilityNpi: string,
  facility: FacilityCreate
): Promise<Facility> {
  if (facilityId) {
    await getFacilityStrictOrFail({ cxId, id: facilityId, npi: facilityNpi });
    const updatedFacility = await updateFacility({
      id: facilityId,
      ...facility,
    });

    return updatedFacility;
  }

  const createdFacility = await createFacility(facility);

  return createdFacility;
}

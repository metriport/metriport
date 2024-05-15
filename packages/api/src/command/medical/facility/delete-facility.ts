import { BadRequestError } from "@metriport/shared";
import { Facility } from "../../../domain/medical/facility";
import { getPatients } from "../patient/get-patient";
import { getFacilityOrFail } from "./get-facility";

type GetFacilitiesQuery = Pick<Facility, "cxId" | "id">;

export async function deleteFacility({ cxId, id }: GetFacilitiesQuery): Promise<void> {
  const facility = await getFacilityOrFail({ cxId, id });
  const patients = await getPatients({ cxId, facilityId: facility.id });
  if (patients.length > 0) {
    throw new BadRequestError(`Cannot delete facility with patients associated to it`);
  }
  await facility.destroy();
}

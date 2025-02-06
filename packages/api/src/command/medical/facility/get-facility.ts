import { BadRequestError, NotFoundError } from "@metriport/shared";
import { Facility } from "../../../domain/medical/facility";
import { FacilityModel } from "../../../models/medical/facility";
import { BadRequestError } from "@metriport/shared";

type GetFacilitiesQuery = Pick<FacilityModel, "cxId"> & Partial<{ ids: FacilityModel["id"][] }>;

export async function getFacilities({ cxId, ids }: GetFacilitiesQuery): Promise<FacilityModel[]> {
  const facilities = await FacilityModel.findAll({
    where: { ...(ids ? { id: ids } : undefined), cxId },
    order: [["id", "ASC"]],
  });
  return facilities;
}

type GetFacilityQuery = Pick<FacilityModel, "id" | "cxId">;

export async function getFacilityOrFail({ cxId, id }: GetFacilityQuery): Promise<FacilityModel> {
  const facility = await FacilityModel.findOne({
    where: {
      id,
      cxId,
    },
  });
  if (!facility) throw new NotFoundError(`Could not find facility`, undefined, { facilityId: id });
  return facility;
}

export async function getSingleFacilityOrFail(cxId: string): Promise<Facility> {
  const facilities = await getFacilities({ cxId });
  if (!facilities || facilities.length < 1) {
    throw new NotFoundError(`Could not find facility`, undefined, { cxId });
  }
  if (facilities.length > 1) {
    throw new BadRequestError(
      `More than one facility found, please specify a facility ID`,
      undefined,
      { cxId }
    );
  }
  return facilities[0];
}

/**
 * Returns the facility for the given customer, if an ID is provided, or the single facility for the
 * customer if no ID is provided.
 *
 * @param cxId - The customer ID.
 * @param facilityId - The facility ID (optional).
 * @returns the Facility
 * @throws BadRequestError if no ID is provided and more than one facility is found for the customer.
 */
export async function getOptionalFacilityOrFail(
  cxId: string,
  facilityId: string | undefined
): Promise<Facility> {
  if (facilityId) {
    return await getFacilityOrFail({ cxId, id: facilityId });
  }
  return await getSingleFacilityOrFail(cxId);
}

export async function getFacilityByOidOrFail(
  filter: GetFacilityQuery & { oid: string }
): Promise<FacilityModel> {
  const facility = await getFacilityOrFail(filter);
  if (facility.oid !== filter.oid) throw new NotFoundError(`Could not find facility`);
  return facility;
}

type GetFacilityByNpiQuery = Pick<FacilityModel, "cxId"> & { npi: string };

export async function getFacilityByNpi({
  cxId,
  npi,
}: GetFacilityByNpiQuery): Promise<FacilityModel | null> {
  const facility = await FacilityModel.findOne({
    where: {
      cxId,
      data: {
        npi,
      },
    },
  });
  return facility;
}

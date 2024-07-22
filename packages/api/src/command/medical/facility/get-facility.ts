import NotFoundError from "../../../errors/not-found";
import { FacilityModel } from "../../../models/medical/facility";

type GetFacilitiesQuery = Pick<FacilityModel, "cxId"> & Partial<{ ids: FacilityModel["id"][] }>;

export async function getFacilities({ cxId, ids }: GetFacilitiesQuery): Promise<FacilityModel[]> {
  const facilities = await FacilityModel.findAll({
    where: {
      ...(ids ? { id: ids } : undefined),
      cxId,
    },
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

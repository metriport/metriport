import NotFoundError from "../../../errors/not-found";
import { FacilityModel } from "../../../models/medical/facility";

type GetFacilitiesQuery = Pick<FacilityModel, "cxId"> & Partial<{ ids: FacilityModel["id"][] }>;

export const getFacilities = async ({
  cxId,
  ids,
}: GetFacilitiesQuery): Promise<FacilityModel[]> => {
  const facility = await FacilityModel.findAll({
    where: {
      ...(ids ? { id: ids } : undefined),
      cxId,
    },
    order: [["id", "ASC"]],
  });
  return facility;
};

type GetFacilityQuery = Pick<FacilityModel, "id" | "cxId">;

export const getFacilityOrFail = async ({ cxId, id }: GetFacilityQuery): Promise<FacilityModel> => {
  const facility = await FacilityModel.findOne({
    where: {
      id,
      cxId,
    },
  });
  if (!facility) throw new NotFoundError(`Could not find facility`, undefined, { facilityId: id });
  return facility;
};

type GetFacilityStrictQuery = GetFacilityQuery & { npi: string };
export const getFacilityStrictOrFail = async ({
  cxId,
  id,
  npi,
}: GetFacilityStrictQuery): Promise<FacilityModel> => {
  const facility = await FacilityModel.findOne({
    where: {
      id,
      cxId,
      data: {
        npi,
      },
    },
  });
  if (!facility)
    throw new NotFoundError(`Could not find facility`, undefined, { facilityId: id, npi });
  return facility;
};

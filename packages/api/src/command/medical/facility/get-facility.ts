import { Patient } from "@metriport/core/domain/patient";
import NotFoundError from "../../../errors/not-found";
import { FacilityModel, FacilityType } from "../../../models/medical/facility";

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

export async function getFacilityFromPatientOrFail(patient: Patient): Promise<FacilityModel> {
  return getFacilityOrFail({ cxId: patient.cxId, id: patient.facilityIds[0] });
}

export function isOboFacility(facilityType: FacilityType) {
  return facilityType === FacilityType.initiatorOnly;
}

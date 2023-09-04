import { FacilityModel } from "../../../models/medical/facility";

type Filter = Pick<FacilityModel, "cxId"> & Partial<Pick<FacilityModel, "id">>;

/**
 * For E2E testing locally and staging.
 */
export const deleteFacility = async ({ cxId, id }: Filter): Promise<void> => {
  await FacilityModel.destroy({
    where: { cxId, ...(id ? { id } : undefined) },
  });
};

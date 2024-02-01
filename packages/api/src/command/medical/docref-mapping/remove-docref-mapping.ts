import { DocRefMappingModel } from "../../../models/medical/docref-mapping";

export const removeDocRefMapping = async ({
  cxId,
  docRefMappingId,
}: {
  cxId: string;
  docRefMappingId: string;
}): Promise<number> => {
  const docRef = { cxId, id: docRefMappingId };
  const res = await DocRefMappingModel.destroy({ where: docRef });
  return res;
};

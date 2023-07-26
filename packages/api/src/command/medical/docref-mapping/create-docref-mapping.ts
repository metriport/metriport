import { DocRefMapping, DocRefMappingCreate } from "../../../domain/medical/docref-mapping";
import { DocRefMappingModel } from "../../../models/medical/docref-mapping";
import { uuidv7 } from "../../../shared/uuid-v7";

export const createDocRefMapping = async (
  createDocRef: DocRefMappingCreate
): Promise<DocRefMapping> => {
  return DocRefMappingModel.create({
    ...createDocRef,
    id: uuidv7(),
  });
};

import { DocRefMapping } from "../../../domain/medical/docref-mapping";
import { MedicalDataSource } from "../../../external";
import { DocRefMappingModel } from "../../../models/medical/docref-mapping";
import { uuidv7 } from "@metriport/core/util/uuid-v7";

export const getDocRefMapping = async (id: string): Promise<DocRefMapping | undefined> => {
  const docRef = await DocRefMappingModel.findByPk(id);
  return docRef ?? undefined;
};

export const getOrCreateDocRefMapping = async ({
  cxId,
  patientId,
  externalId,
  source,
}: {
  cxId: string;
  patientId: string;
  externalId: string;
  source: MedicalDataSource;
}): Promise<DocRefMapping> => {
  const docRef = { cxId, patientId, externalId, source };
  const [res] = await DocRefMappingModel.findOrCreate({
    where: docRef,
    defaults: {
      id: uuidv7(),
      ...docRef,
    },
  });
  return res;
};

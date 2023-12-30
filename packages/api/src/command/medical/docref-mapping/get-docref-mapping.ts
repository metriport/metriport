import { DocRefMapping } from "../../../domain/medical/docref-mapping";
import { MedicalDataSource } from "../../../external";
import { DocRefMappingModel } from "../../../models/medical/docref-mapping";
import { uuidv7 } from "@metriport/core/util/uuid-v7";

export const getDocRefMapping = async (id: string): Promise<DocRefMapping | undefined> => {
  const docRef = await DocRefMappingModel.findByPk(id);
  return docRef ?? undefined;
};

export const getAllDocRefMappingByRequestId = async (
  requestId: string
): Promise<DocRefMapping[]> => {
  const docRefs = await DocRefMappingModel.findAll({
    where: { requestId },
  });
  return docRefs;
};

export const getOrCreateDocRefMapping = async ({
  cxId,
  patientId,
  requestId,
  externalId,
  source,
}: {
  cxId: string;
  patientId: string;
  requestId: string;
  externalId: string;
  source: MedicalDataSource;
}): Promise<DocRefMapping> => {
  const docRef = { cxId, patientId, externalId, requestId, source };
  const [res] = await DocRefMappingModel.findOrCreate({
    where: docRef,
    defaults: {
      id: uuidv7(),
      ...docRef,
    },
  });
  return res;
};

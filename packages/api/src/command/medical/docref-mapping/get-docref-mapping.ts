import { DocRefMapping } from "../../../domain/medical/docref-mapping";
import { MedicalDataSource } from "../../../external";
import { DocRefMappingModel } from "../../../models/medical/docref-mapping";

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
    // no need for `defaults` since all columns for the new record are part of the filter
  });
  return res;
};

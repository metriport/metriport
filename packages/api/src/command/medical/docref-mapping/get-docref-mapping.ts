import { DocRefMapping } from "../../../domain/medical/docref-mapping";
import { MedicalDataSource } from "../../../external";
import { DocRefMappingModel } from "../../../models/medical/docref-mapping";
import { createDocRefMapping } from "./create-docref-mapping";

export const getDocRefMapping = async (id: string): Promise<DocRefMapping | undefined> => {
  const docRef = await DocRefMappingModel.findByPk(id);
  return docRef ?? undefined;
};

export const getDocRefMappingByUnique = async ({
  cxId,
  patientId,
  externalId,
  source,
}: {
  cxId: string;
  patientId: string;
  externalId: string;
  source: MedicalDataSource;
}): Promise<DocRefMapping | undefined> => {
  const docRef = await DocRefMappingModel.findOne({
    where: { cxId, patientId, externalId, source },
  });
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
  const existingDocRef = await getDocRefMappingByUnique(docRef);
  if (existingDocRef) return existingDocRef;
  return createDocRefMapping(docRef);
};

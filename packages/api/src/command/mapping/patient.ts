import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../../errors/not-found";
import { PatientMappingModel } from "../../models/patient-mapping";
import { PatientMapping } from "../../domain/patient-mapping";

export type PatientMappingParams = {
  cxId: string;
  patientId: string;
  externalId: string;
  source: string;
};

export type PatientMappingLookUpParam = Omit<PatientMappingParams, "patientId">;

export async function findOrCreatePatientMapping({
  cxId,
  patientId,
  externalId,
  source,
}: PatientMappingParams): Promise<PatientMapping> {
  const existing = await getPatientMapping({ cxId, externalId, source });
  if (existing) return existing;
  const created = await PatientMappingModel.create({
    id: uuidv7(),
    cxId,
    patientId,
    externalId,
    source,
  });
  return created.dataValues;
}

export async function getPatientMapping({
  cxId,
  externalId,
  source,
}: PatientMappingLookUpParam): Promise<PatientMapping | undefined> {
  const existing = await PatientMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (!existing) return undefined;
  return existing.dataValues;
}

export async function getPatientMappingOrFail({
  cxId,
  externalId,
  source,
}: PatientMappingLookUpParam): Promise<PatientMapping> {
  const mapping = await getPatientMapping({
    cxId,
    externalId,
    source,
  });
  if (!mapping)
    throw new NotFoundError("Mapping not found", undefined, { cxId, externalId, source });
  return mapping;
}

export async function deletePatientMapping({
  cxId,
  externalId,
  source,
}: PatientMappingLookUpParam): Promise<void> {
  const existing = await PatientMappingModel.findOne({
    where: { cxId, externalId, source },
  });
  if (!existing) {
    throw new NotFoundError("Entry not found", undefined, { cxId, externalId, source });
  }
  await existing.destroy();
}

export async function deleteAllPatientMappings({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<void> {
  await PatientMappingModel.destroy({
    where: { cxId, patientId },
  });
}

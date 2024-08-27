import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../../errors/not-found";
import { PatientMappingModel } from "../../models/patient-mapping";

export type PatientMappingParams = {
  patientId: string;
  externalId: string;
  source: string;
};

export type PatientMappingLookUpParam = Omit<PatientMappingParams, "patientId">;

export async function createPatientMapping({
  patientId,
  externalId,
  source,
}: PatientMappingParams): Promise<void> {
  const existing = await PatientMappingModel.findOne({
    where: { patientId, externalId, source },
  });
  if (existing) return;
  await PatientMappingModel.create({ id: uuidv7(), patientId, externalId, source });
  return;
}

export async function getPatientMappingId({
  externalId,
  source,
}: PatientMappingLookUpParam): Promise<string | undefined> {
  const existing = await PatientMappingModel.findOne({
    where: { externalId, source },
  });
  if (!existing) return undefined;
  return existing.patientId;
}

export async function deletePatientMapping({
  patientId,
  externalId,
  source,
}: PatientMappingParams): Promise<void> {
  const existing = await PatientMappingModel.findOne({
    where: { patientId, externalId, source },
  });
  if (!existing) throw new NotFoundError("Entry not found", undefined, { patientId });
  await existing.destroy();
}

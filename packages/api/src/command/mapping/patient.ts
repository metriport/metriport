import { uuidv7 } from "@metriport/core/util/uuid-v7";
import NotFoundError from "../../errors/not-found";
import { PatientMappingModel } from "../../models/patient-mapping";

export type PatientMappingParams = {
  patientId: string;
  externalId: string;
  source: string;
};

export type PatientMappingLookUpParam = Omit<PatientMappingParams, "patientId">;

export async function findOrCreatePatientMapping({
  patientId,
  externalId,
  source,
}: PatientMappingParams): Promise<PatientMappingModel> {
  const existing = await getPatientMapping({ externalId, source });
  if (existing) return existing;
  return await PatientMappingModel.create({ id: uuidv7(), patientId, externalId, source });
}

export async function getPatientMapping({
  externalId,
  source,
}: PatientMappingLookUpParam): Promise<PatientMappingModel | undefined> {
  const existing = await PatientMappingModel.findOne({
    where: { externalId, source },
  });
  if (!existing) return undefined;
  return existing;
}

export async function deletePatientMapping({
  externalId,
  source,
}: PatientMappingLookUpParam): Promise<void> {
  const existing = await getPatientMapping({ externalId, source });
  if (!existing) {
    throw new NotFoundError("Entry not found", undefined, { externalId, source });
  }
  await existing.destroy();
}

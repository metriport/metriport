import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import {
  PatientMapping,
  PatientMappingPerSource,
  PatientSourceMap,
} from "../../domain/patient-mapping";
import { PatientMappingModel } from "../../models/patient-mapping";
import { Op } from "sequelize";
export type PatientMappingParams = PatientMappingPerSource;

export type PatientMappingLookUpParams = Omit<PatientMappingParams, "patientId">;

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
}: PatientMappingLookUpParams): Promise<PatientMapping | undefined> {
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
}: PatientMappingLookUpParams): Promise<PatientMapping> {
  const mapping = await getPatientMapping({
    cxId,
    externalId,
    source,
  });
  if (!mapping) {
    throw new NotFoundError("PatientMapping not found", undefined, { cxId, externalId, source });
  }
  return mapping;
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

export async function getPatientExternalIdsFromSources({
  cxId,
  patientId,
  sources,
}: {
  cxId: string;
  patientId: string;
  sources: string[];
}): Promise<PatientSourceMap | undefined> {
  const mappings = await PatientMappingModel.findAll({
    where: { cxId, patientId, source: { [Op.in]: sources } },
  });
  const ehrIds = mappings.reduce((acc, mapping) => {
    const { source, externalId } = mapping.dataValues;
    acc[source] = externalId;
    return acc;
  }, {} as PatientSourceMap);
  return Object.keys(ehrIds).length > 0 ? ehrIds : undefined;
}

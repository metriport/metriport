import { Patient } from "@metriport/core/domain/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { NotFoundError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Transaction } from "sequelize";
import {
  PatientMapping,
  PatientMappingPerSource,
  PatientSourceIdentifierMap,
} from "../../domain/patient-mapping";
import { parseExternalId } from "../../external/ehr/shared/jwt-token";
import { PatientMappingModel } from "../../models/patient-mapping";

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

export async function getPatientMappings(
  { cxId, id: patientId }: Pick<Patient, "id" | "cxId">,
  transaction?: Transaction
): Promise<PatientMapping[]> {
  const mappings = await PatientMappingModel.findAll({
    where: { cxId, patientId },
    order: [["createdAt", "ASC"]],
    transaction,
  });
  return mappings.map(m => m.dataValues);
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

export const defaultSources = [EhrSources.athena, EhrSources.canvas, EhrSources.elation];

export function getSourceMapForPatient({
  mappings,
  sources = defaultSources,
}: {
  mappings: PatientMapping[];
  sources?: string[];
}): PatientSourceIdentifierMap | undefined {
  const sourceMap = mappings.reduce((acc, mapping) => {
    const { source, externalId } = mapping;
    if (sources.includes(source)) {
      acc[source] = [...(acc[source] || []), parseExternalId(source, externalId)];
    }
    return acc;
  }, {} as PatientSourceIdentifierMap);
  return Object.keys(sourceMap).length > 0 ? sourceMap : undefined;
}

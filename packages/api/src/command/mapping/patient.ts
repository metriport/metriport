import { Patient } from "@metriport/core/domain/patient";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError, NotFoundError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Transaction } from "sequelize";
import {
  PatientMapping,
  PatientMappingPerSource,
  PatientMappingSecondaryMappings,
  PatientSourceIdentifierMap,
  secondaryMappingsSchemaMap,
} from "../../domain/patient-mapping";
import { parseExternalId } from "../../external/ehr/shared/utils/external-id";
import { PatientMappingModel } from "../../models/patient-mapping";

export type PatientMappingParams = PatientMappingPerSource;

export type PatientMappingLookUpParams = Omit<
  PatientMappingParams,
  "patientId" | "secondaryMappings"
>;
export type PatientMappingLookupByIdParams = Pick<PatientMappingParams, "cxId" | "patientId"> & {
  id: string;
};

export async function findOrCreatePatientMapping({
  cxId,
  patientId,
  externalId,
  source,
  secondaryMappings,
}: PatientMappingParams): Promise<PatientMapping> {
  const existing = await getPatientMapping({ cxId, externalId, source });
  if (existing) return existing;
  return createPatientMapping({ cxId, patientId, externalId, source, secondaryMappings });
}

export async function createPatientMapping({
  cxId,
  patientId,
  externalId,
  source,
  secondaryMappings,
}: PatientMappingParams): Promise<PatientMapping> {
  const created = await PatientMappingModel.create({
    id: uuidv7(),
    cxId,
    patientId,
    externalId,
    source,
    secondaryMappings,
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

export const defaultSources = [
  EhrSources.athena,
  EhrSources.canvas,
  EhrSources.elation,
  EhrSources.healthie,
];

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

export async function findFirstPatientMappingForSource({
  patientId,
  source,
}: Omit<PatientMappingParams, "cxId" | "externalId" | "secondaryMappings">): Promise<
  PatientMapping | undefined
> {
  const mappings = await PatientMappingModel.findOne({
    where: { patientId, source },
    order: [["createdAt", "ASC"]],
    limit: 1,
  });
  return mappings?.dataValues;
}

export async function findPatientWithExternalId({
  externalId,
  source,
}: Omit<PatientMappingParams, "cxId" | "patientId">): Promise<PatientMapping | undefined> {
  const mappings = await PatientMappingModel.findOne({
    where: { externalId, source },
    order: [["createdAt", "ASC"]],
    limit: 1,
  });
  return mappings?.dataValues;
}

async function getPatientMappingModelById({
  cxId,
  patientId,
  id,
}: PatientMappingLookupByIdParams): Promise<PatientMappingModel | undefined> {
  const existing = await PatientMappingModel.findOne({
    where: { cxId, patientId, id },
  });
  if (!existing) return undefined;
  return existing;
}

async function getPatientMappingModelByIdOrFail({
  cxId,
  patientId,
  id,
}: PatientMappingLookupByIdParams): Promise<PatientMappingModel> {
  const mapping = await getPatientMappingModelById({
    cxId,
    patientId,
    id,
  });
  if (!mapping) {
    throw new NotFoundError("PatientMapping not found", undefined, { cxId, patientId, id });
  }
  return mapping;
}

export async function getSecondaryMappingsOrFail({
  cxId,
  externalId,
  source,
}: PatientMappingLookUpParams): Promise<PatientMappingSecondaryMappings> {
  const mapping = await getPatientMappingOrFail({ cxId, externalId, source });
  return mapping.secondaryMappings;
}

export async function setSecondaryMappingsOnPatientMappingById({
  cxId,
  patientId,
  id,
  secondaryMappings,
}: PatientMappingLookupByIdParams & {
  secondaryMappings: PatientMappingSecondaryMappings;
}): Promise<PatientMapping> {
  const existing = await getPatientMappingModelByIdOrFail({ cxId, patientId, id });
  const schema = secondaryMappingsSchemaMap[existing.source];
  if (!schema) {
    throw new MetriportError("Schema to validate new secondary mappings not found", undefined, {
      source: existing.source,
    });
  }
  const validatedSecondaryMappings = schema.parse(secondaryMappings);
  const updated = await existing.update({ secondaryMappings: validatedSecondaryMappings });
  return updated.dataValues;
}

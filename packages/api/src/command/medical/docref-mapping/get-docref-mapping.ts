import { MedicalDataSource } from "@metriport/core/external/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Op, QueryTypes } from "sequelize";
import { DocRefMapping } from "../../../domain/medical/docref-mapping";
import {
  DocRefMappingModel,
  docRefMappingModelColumns as c,
} from "../../../models/medical/docref-mapping";

export const getDocRefMapping = async (id: string): Promise<DocRefMapping | undefined> => {
  const docRef = await DocRefMappingModel.findByPk(id);
  return docRef ?? undefined;
};

export const getAllDocRefMapping = async ({
  requestId,
  patientId,
  cxId,
}: {
  requestId: string;
  patientId?: string;
  cxId?: string;
}): Promise<DocRefMapping[]> => {
  const docRefs = await DocRefMappingModel.findAll({
    where: {
      requestId,
      ...(patientId && { patientId }),
      ...(cxId && { cxId }),
    },
  });
  return docRefs;
};

/**
 * TEST (1)
 */
export async function getOrCreateDocRefMapping({
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
}): Promise<DocRefMapping> {
  const docRef = { cxId, patientId, externalId, source, requestId };
  const [res] = await DocRefMappingModel.findOrCreate({
    where: docRef,
    defaults: {
      id: uuidv7(),
      ...docRef,
    },
  });
  return res;
}

/**
 * TEST (2)
 */
export async function getOrCreateDocRefMappingInsertOrSelect({
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
}): Promise<DocRefMapping> {
  const docRef = { cxId, patientId, externalId, source, requestId };
  try {
    const res = await DocRefMappingModel.create({
      id: uuidv7(),
      ...docRef,
    });
    console.log(`Inserted, returning it...`);
    return res.dataValues;
  } catch (error) {
    console.log(`Didn't insert, returning result from a new query...`);
    const res = await DocRefMappingModel.findOne({
      where: docRef,
    });
    if (res) return res.dataValues;
    throw new Error("DocRefMapping not found");
  }
}

/**
 * TEST (3)
 */
const sql = `
  WITH neworexisting AS (
    INSERT INTO docref_mapping(${c.id},${c.externalId},${c.cxId},${c.patientId},${c.source},${c.requestId})
      VALUES(:id, :externalId, :cxId, :patientId, :source, :requestId)
    ON CONFLICT(${c.externalId}, ${c.patientId}, ${c.cxId}, ${c.source}) DO UPDATE SET updated_at=now()
    RETURNING *
  )
  SELECT * FROM neworexisting
`;
export async function getOrCreateDocRefMappingInsert({
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
}): Promise<DocRefMapping> {
  const replacements = {
    id: uuidv7(),
    externalId,
    cxId,
    patientId,
    source,
    requestId,
  };
  const res = await DocRefMappingModel.sequelize?.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    mapToModel: true,
    model: DocRefMappingModel,
  });
  const docRefMapping = res ? res[0] : undefined;
  if (!docRefMapping) {
    throw new Error("DocRefMapping not found");
  }
  return docRefMapping;
}

export const getDocRefMappings = async ({
  cxId,
  ids = [],
  patientId: patientIdParam = [],
  externalId,
  source,
  createdAtRange: { from, to } = {},
}: {
  cxId: string;
  ids?: string[];
  patientId?: string[] | string;
  externalId?: string;
  source?: MedicalDataSource;
  createdAtRange?: { from?: Date; to?: Date };
}): Promise<DocRefMapping[]> => {
  const patientIds = Array.isArray(patientIdParam) ? patientIdParam : [patientIdParam];
  const res = await DocRefMappingModel.findAll({
    where: {
      cxId,
      ...(ids && ids.length ? { id: { [Op.in]: ids } } : {}),
      ...(patientIds.length ? { patientId: { [Op.in]: patientIds } } : {}),
      ...(externalId ? { externalId } : {}),
      ...(source ? { source } : {}),
      ...(from || to
        ? { createdAt: { ...(from && { [Op.gte]: from }), ...(to && { [Op.lte]: to }) } }
        : {}),
    },
  });
  return res;
};

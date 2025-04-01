import { MedicalDataSource } from "@metriport/core/external/index";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { Op, QueryTypes } from "sequelize";
import { DocRefMapping } from "../../../domain/medical/docref-mapping";
import {
  DocRefMappingModel,
  docRefMappingModelColumns as c,
} from "../../../models/medical/docref-mapping";

export const getDocRefMapping = async (id: string): Promise<DocRefMapping | undefined> => {
  const docRef = await DocRefMappingModel.findByPk(id, {
    attributes: ["id", "externalId", "cxId", "patientId", "source", "requestId"],
  });
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
    attributes: ["id", "externalId", "cxId", "patientId", "source", "requestId"],
    where: {
      requestId,
      ...(patientId && { patientId }),
      ...(cxId && { cxId }),
    },
  });
  return docRefs;
};

const sql = `
  WITH neworexisting AS (
    INSERT INTO ${DocRefMappingModel.NAME}(${c.id},${c.externalId},${c.cxId},${c.patientId},${c.source},${c.requestId})
      VALUES(:id, :externalId, :cxId, :patientId, :source, :requestId)
    ON CONFLICT(${c.externalId}, ${c.patientId}, ${c.cxId}, ${c.source}) DO UPDATE SET ${c.udpatedAt}=now()
    RETURNING *
  )
  SELECT * FROM neworexisting
`;
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
    attributes: ["id", "externalId", "cxId", "patientId", "source", "requestId"],
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

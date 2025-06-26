import { buildDayjs } from "@metriport/shared/common/date";
import { QueryTypes } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { Pagination, sortForPagination } from "../../pagination";

/**
 * Add a default filter date far in the past to guarantee hitting the compound index
 */
const DEFAULT_FILTER_DATE = new Date("2020-01-01T00:00:00.000Z");

export type TcmEncounterQueryData = TcmEncounterModel["dataValues"] & {
  patientData: PatientModel["dataValues"]["data"];
};

export type TcmEncounterQueryResult = TcmEncounterModel & {
  dataValues: TcmEncounterQueryData;
};

const tcmEncounterTable = TcmEncounterModel.tableName;
const patientTable = PatientModel.tableName;

export async function getTcmEncounters({
  cxId,
  after,
  pagination,
}: {
  cxId: string;
  after?: string;
  pagination: Pagination;
}): Promise<TcmEncounterQueryData[]> {
  const encounters = await runQuery<TcmEncounterQueryResult>({
    columns: [`${tcmEncounterTable}.*`, `${patientTable}.data as patientData`],
    replacements: {
      cxId,
      ...{ afterDate: after ? buildDayjs(after).toDate() : DEFAULT_FILTER_DATE },
    },
    pagination,
  });

  return sortForPagination(
    encounters.map(e => e.dataValues),
    pagination
  );
}

export async function getTcmEncountersCount({
  cxId,
  after,
}: {
  cxId: string;
  after?: string;
}): Promise<number> {
  const result = await runQuery<{ count: number }>({
    columns: [`count(${tcmEncounterTable}.id) as count`],
    replacements: {
      cxId,
      ...{ afterDate: after ? buildDayjs(after).toDate() : DEFAULT_FILTER_DATE },
    },
  });

  return parseInt(result[0].count.toString());
}

function runQuery<T>({
  columns,
  replacements,
  pagination,
}: {
  columns: string[];
  replacements: Record<string, string | number | Date>;
  pagination?: Pagination;
}): Promise<T[]> {
  const sequelize = TcmEncounterModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const { toItem, fromItem, count } = pagination ?? {};

  const baseQueryString = `
      SELECT ${columns.join(", ")}
      FROM ${tcmEncounterTable} tcm_encounter
      INNER JOIN ${patientTable} patient 
      ON tcm_encounter.patient_id = patient.id
      WHERE tcm_encounter.cx_id = :cxId
      AND tcm_encounter.admit_time > :afterDate
    `;

  const paginationQueryString = `
      ${toItem ? ` AND tcm_encounter.id >= :toItem` : ""}
      ${fromItem ? ` AND tcm_encounter.id <= :fromItem` : ""}
      ORDER BY tcm_encounter.id ${toItem ? "ASC" : "DESC"}
      ${count ? ` LIMIT :count` : ""}
    `;

  const queryString = `${baseQueryString} ${pagination ? paginationQueryString : ""}`;

  return sequelize.query(queryString, {
    replacements,
    type: QueryTypes.SELECT,
  }) as Promise<T[]>;
}

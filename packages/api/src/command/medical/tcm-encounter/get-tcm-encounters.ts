import { buildDayjs } from "@metriport/shared/common/date";
import { QueryTypes } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { Pagination, sortForPagination } from "../../pagination";
import { omit } from "lodash";

/**
 * Add a default filter date far in the past to guarantee hitting the compound index
 */
const DEFAULT_FILTER_DATE = new Date("2020-01-01T00:00:00.000Z");

export interface TcmEncounterQueryData extends TcmEncounterModel {
  dataValues: TcmEncounterModel["dataValues"] & {
    patient_data: PatientModel["dataValues"]["data"];
  };
}

export type TcmEncounterResult = TcmEncounterModel["dataValues"] & {
  patientData: PatientModel["dataValues"]["data"];
};

export async function getTcmEncounters({
  cxId,
  after,
  pagination,
}: {
  cxId: string;
  after?: string;
  pagination: Pagination;
}): Promise<TcmEncounterResult[]> {
  const tcmEncounterTable = TcmEncounterModel.tableName;
  const patientTable = PatientModel.tableName;

  const sequelize = TcmEncounterModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const { toItem, fromItem } = pagination;

  /**
   * ⚠️ Always change this query and the count query together.
   */
  const queryString = `
      SELECT tcm_encounter.*, patient.data as patient_data
      FROM ${tcmEncounterTable} tcm_encounter
      INNER JOIN ${patientTable} patient 
      ON tcm_encounter.patient_id = patient.id
      WHERE tcm_encounter.cx_id = :cxId
      AND tcm_encounter.admit_time > :afterDate
      ${toItem ? ` AND tcm_encounter.id >= :toItem` : ""}
      ${fromItem ? ` AND tcm_encounter.id <= :fromItem` : ""}
      ORDER BY tcm_encounter.id ${toItem ? "ASC" : "DESC"}
      LIMIT :count
    `;

  /**
   * Use a type assertion to cast the additional data from the join into the return type.
   */
  const rawEncounters = (await sequelize.query(queryString, {
    model: TcmEncounterModel,
    mapToModel: true,
    replacements: {
      cxId,
      ...{ afterDate: after ? buildDayjs(after).toDate() : DEFAULT_FILTER_DATE },
      ...pagination,
    },
    type: QueryTypes.SELECT,
  })) as TcmEncounterQueryData[];

  const encounters = rawEncounters.map(e => ({
    ...omit(e.dataValues, "patient_data"),
    patientData: e.dataValues.patient_data,
  }));

  return sortForPagination(encounters, pagination);
}

export async function getTcmEncountersCount({
  cxId,
  after,
}: {
  cxId: string;
  after?: string;
}): Promise<number> {
  const tcmEncounterTable = TcmEncounterModel.tableName;

  const sequelize = TcmEncounterModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  /**
   * ⚠️ Always change this query and the data query together.
   */
  const queryString = `
    SELECT count(tcm_encounter.id) as count
    FROM ${tcmEncounterTable} tcm_encounter
    WHERE tcm_encounter.cx_id = :cxId
    AND tcm_encounter.admit_time > :afterDate
  `;

  const result = await sequelize.query<{ count: number }>(queryString, {
    replacements: {
      cxId,
      ...{ afterDate: after ? buildDayjs(after).toDate() : DEFAULT_FILTER_DATE },
    },
    type: QueryTypes.SELECT,
  });

  return parseInt(result[0].count.toString());
}

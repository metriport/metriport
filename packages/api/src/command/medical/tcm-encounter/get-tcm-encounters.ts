import { buildDayjs } from "@metriport/shared/common/date";
import { omit, snakeCase } from "lodash";
import { QueryTypes } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { PaginationWithCursor } from "../../pagination";

/**
 * Add a default filter date far in the past to guarantee hitting the compound index
 */
const DEFAULT_FILTER_DATE = new Date("2020-01-01T00:00:00.000Z");

export interface TcmEncounterQueryData extends TcmEncounterModel {
  dataValues: TcmEncounterModel["dataValues"] & {
    patient_data: PatientModel["dataValues"]["data"];
    patient_facility_ids: PatientModel["dataValues"]["facilityIds"];
  };
}

export type TcmEncounterResult = TcmEncounterModel["dataValues"] & {
  patientData: PatientModel["dataValues"]["data"];
  patientFacilityIds: PatientModel["dataValues"]["facilityIds"];
};

// Column validation and WHERE clause building is now handled centrally in the paginated() function

export async function getTcmEncounters({
  cxId,
  after,
  facilityId,
  daysLookback,
  eventType,
  coding,
  status,
  pagination,
}: {
  cxId: string;
  after?: string;
  facilityId?: string;
  daysLookback?: string;
  eventType?: string;
  coding?: string;
  status?: string;
  pagination: PaginationWithCursor;
}): Promise<TcmEncounterResult[]> {
  const tcmEncounterTable = TcmEncounterModel.tableName;
  const patientTable = PatientModel.tableName;

  const sequelize = TcmEncounterModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const { fromItemClause = { clause: "", params: {} }, toItemClause = { clause: "", params: {} } } =
    pagination;

  const dischargedAfter = daysLookback
    ? buildDayjs().subtract(parseInt(daysLookback), "day").toDate()
    : undefined;

  function getTableForColumn(column: string): string {
    // Map camelCase columns to their tables for ORDER BY
    const columnTableMap: Record<string, string> = {
      id: "tcm_encounter",
      admitTime: "tcm_encounter",
      dischargeTime: "tcm_encounter",
    };
    return columnTableMap[column] || "tcm_encounter";
  }

  function createOrderByClause({ col, order }: { col: string; order: string }) {
    const table = getTableForColumn(col);
    const dbCol = snakeCase(col); // Transform camelCase to snake_case for SQL
    return `${table}.${dbCol} ${order.toUpperCase()}`;
  }

  /**
   * ⚠️ Always change this query and the count query together.
   */
  const queryString = `
      SELECT tcm_encounter.*, patient.data as patient_data, patient.facility_ids as patient_facility_ids
      FROM ${tcmEncounterTable} tcm_encounter
      INNER JOIN ${patientTable} patient 
      ON tcm_encounter.patient_id = patient.id
      WHERE tcm_encounter.cx_id = :cxId
      AND tcm_encounter.admit_time > :admittedAfter
      ${
        daysLookback
          ? ` AND (tcm_encounter.discharge_time > :dischargedAfter OR tcm_encounter.discharge_time IS NULL)`
          : ""
      }
      ${facilityId ? ` AND patient.facility_ids @> ARRAY[:facilityId]::varchar[]` : ""}
      ${eventType ? ` AND tcm_encounter.latest_event = :eventType` : ""}
      ${status ? ` AND tcm_encounter.outreach_status = :status` : ""}
      ${coding === "cardiac" ? ` AND tcm_encounter.has_cardiac_code = true` : ""}
      ${/* COMPOSITE CURSOR PAGINATION */ ""}
      ${toItemClause.clause}
      ${fromItemClause.clause}
      ORDER BY ${pagination.sort.map(createOrderByClause).join(", ")}
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
      ...{ admittedAfter: after ? buildDayjs(after).toISOString() : DEFAULT_FILTER_DATE },
      ...{ dischargedAfter },
      ...{ facilityId },
      ...{ eventType },
      ...{ coding },
      ...{ status },
      ...{ count: pagination.count },
      // Include composite cursor parameters
      ...fromItemClause.params,
      ...toItemClause.params,
    },
    type: QueryTypes.SELECT,
  })) as TcmEncounterQueryData[];

  const encounters = rawEncounters.map(e => ({
    ...omit(e.dataValues, ["patient_data", "patient_facility_ids"]),
    patientData: e.dataValues.patient_data,
    patientFacilityIds: e.dataValues.patient_facility_ids,
  }));

  return encounters;
}

export async function getTcmEncountersCount({
  cxId,
  after,
  facilityId,
  daysLookback,
  eventType,
  coding,
  status,
}: {
  cxId: string;
  after?: string;
  facilityId?: string;
  daysLookback?: string;
  eventType?: string;
  coding?: string;
  status?: string;
}): Promise<number> {
  const tcmEncounterTable = TcmEncounterModel.tableName;
  const patientTable = PatientModel.tableName;

  const sequelize = TcmEncounterModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const dischargedAfter = daysLookback
    ? buildDayjs().subtract(parseInt(daysLookback), "day").toDate()
    : undefined;

  /**
   * ⚠️ Always change this query and the data query together.
   */
  const queryString = `
    SELECT count(tcm_encounter.id) as count
    FROM ${tcmEncounterTable} tcm_encounter
    INNER JOIN ${patientTable} patient 
    ON tcm_encounter.patient_id = patient.id
    WHERE tcm_encounter.cx_id = :cxId
    AND tcm_encounter.admit_time > :admittedAfter
    ${
      daysLookback
        ? ` AND (tcm_encounter.discharge_time > :dischargedAfter OR tcm_encounter.discharge_time IS NULL)`
        : ""
    }
    ${facilityId ? ` AND patient.facility_ids @> ARRAY[:facilityId]::varchar[]` : ""}
    ${eventType ? ` AND tcm_encounter.latest_event = :eventType` : ""}
    ${status ? ` AND tcm_encounter.outreach_status = :status` : ""}
    ${coding === "cardiac" ? ` AND tcm_encounter.has_cardiac_code = true` : ""}
  `;

  const result = await sequelize.query<{ count: number }>(queryString, {
    replacements: {
      cxId,
      ...{ admittedAfter: after ? buildDayjs(after).toDate() : DEFAULT_FILTER_DATE },
      ...{ dischargedAfter },
      ...{ facilityId },
      ...{ eventType },
      ...{ coding },
      ...{ status },
    },
    type: QueryTypes.SELECT,
  });

  return parseInt(result[0].count.toString());
}

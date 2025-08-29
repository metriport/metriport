import { buildDayjs } from "@metriport/shared/common/date";
import { omit } from "lodash";
import { QueryTypes } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { getPaginationSorting, Pagination, sortForPagination } from "../../pagination";

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
  pagination: Pagination;
}): Promise<TcmEncounterResult[]> {
  const tcmEncounterTable = TcmEncounterModel.tableName;
  const patientTable = PatientModel.tableName;

  const sequelize = TcmEncounterModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const { toItem, fromItem } = pagination;
  const [, order] = getPaginationSorting(pagination);

  const dischargedAfter = daysLookback
    ? buildDayjs().subtract(parseInt(daysLookback), "day").toDate()
    : undefined;

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
      ${/* PAGINATION */ ""}
      ${toItem ? ` AND tcm_encounter.id >= :toItem` : ""}
      ${fromItem ? ` AND tcm_encounter.id <= :fromItem` : ""}
      ORDER BY tcm_encounter.id ${order}
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
      ...pagination,
    },
    type: QueryTypes.SELECT,
  })) as TcmEncounterQueryData[];

  const encounters = rawEncounters.map(e => ({
    ...omit(e.dataValues, ["patient_data", "patient_facility_ids"]),
    patientData: e.dataValues.patient_data,
    patientFacilityIds: e.dataValues.patient_facility_ids,
  }));

  return sortForPagination(encounters, pagination);
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

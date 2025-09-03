import { buildDayjs } from "@metriport/shared/common/date";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { omit } from "lodash";
import { QueryTypes } from "sequelize";
import { PatientModel } from "../../../models/medical/patient";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { PatientMappingModel } from "../../../models/patient-mapping";
import { getPaginationSorting, Pagination, sortForPagination } from "../../pagination";

/**
 * Add a default filter date far in the past to guarantee hitting the compound index
 */
const DEFAULT_FILTER_DATE = new Date("2020-01-01T00:00:00.000Z");
const ECLINICALWORKS_PATIENT_URL_BASE = "https://eclinicalworks.com/p/form";

export interface TcmEncounterQueryData extends TcmEncounterModel {
  dataValues: TcmEncounterModel["dataValues"] & {
    patient_data: PatientModel["dataValues"]["data"];
    patient_facility_ids: PatientModel["dataValues"]["facilityIds"];
    patient_mappings: Array<{
      external_id: string;
      source: string;
    }>;
  };
}

type ExternalUrlItem = { url: string; source: string };

export type TcmEncounterResult = TcmEncounterModel["dataValues"] & {
  patientData: PatientModel["dataValues"]["data"];
  patientFacilityIds: PatientModel["dataValues"]["facilityIds"];
  externalUrls: Array<ExternalUrlItem>;
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
  encounterClass,
  search, // by facility and patient name (can be extended)
}: {
  cxId: string;
  after?: string;
  facilityId?: string;
  daysLookback?: string;
  eventType?: string;
  coding?: string;
  status?: string;
  pagination: Pagination;
  encounterClass?: string;
  search?: string;
}): Promise<TcmEncounterResult[]> {
  const tcmEncounterTable = TcmEncounterModel.tableName;
  const patientTable = PatientModel.tableName;
  const patientMappingTable = PatientMappingModel.tableName;

  const sequelize = TcmEncounterModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const { toItem, fromItem } = pagination;
  const [, order] = getPaginationSorting(pagination);

  const dischargedAfter = daysLookback
    ? buildDayjs().subtract(parseInt(daysLookback), "day").toDate()
    : undefined;

  /**
   * ⚠️ Always change this query and the count query together.
   * NOTE: patientMappingTable is skipped in the count query because it's not needed. Unless need to measure query performance.
   */
  const queryString = `
      SELECT
        tcm_encounter.*,
        patient.data as patient_data,
        patient.facility_ids as patient_facility_ids,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'external_id', patient_mapping.external_id,
              'source', patient_mapping.source
            )
          ) FILTER (WHERE patient_mapping.external_id IS NOT NULL),
          '[]'::json
        ) as patient_mappings
      FROM ${tcmEncounterTable} tcm_encounter
      INNER JOIN ${patientTable} patient 
      ON tcm_encounter.patient_id = patient.id
      LEFT JOIN ${patientMappingTable} patient_mapping
      ON tcm_encounter.patient_id = patient_mapping.patient_id
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
      ${encounterClass ? ` AND tcm_encounter.class = :encounterClass` : ""}
      ${
        search
          ? ` AND (tcm_encounter.facility_name ILIKE :search OR patient.data->>'firstName' ILIKE :search OR patient.data->>'lastName' ILIKE :search)`
          : ""
      }
      ${/* PAGINATION */ ""}
      ${toItem ? ` AND tcm_encounter.id >= :toItem` : ""}
      ${fromItem ? ` AND tcm_encounter.id <= :fromItem` : ""}
      GROUP BY tcm_encounter.id, patient.id, patient.data, patient.facility_ids
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
      ...{ search: search ? `%${search}%` : "" },
      ...{ encounterClass },
      ...pagination,
    },
    type: QueryTypes.SELECT,
  })) as TcmEncounterQueryData[];

  const encounters = rawEncounters.map(e => {
    const mappings = e.dataValues.patient_mappings ?? [];

    return {
      ...omit(e.dataValues, ["patient_data", "patient_facility_ids", "patient_mappings"]),
      patientData: e.dataValues.patient_data,
      patientFacilityIds: e.dataValues.patient_facility_ids,
      externalUrls: mappings
        .map(mapping => ({
          url: constructExternalUrl(mapping.source, mapping.external_id, true),
          source: mapping.source,
        }))
        .filter((item): item is ExternalUrlItem => item.url !== undefined),
    };
  });

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
  search,
  encounterClass,
}: {
  cxId: string;
  after?: string;
  facilityId?: string;
  daysLookback?: string;
  eventType?: string;
  coding?: string;
  status?: string;
  search?: string;
  encounterClass?: string;
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
    ${encounterClass ? ` AND tcm_encounter.class = :encounterClass` : ""}
    ${
      search
        ? ` AND (tcm_encounter.facility_name ILIKE :search OR patient.data->>'firstName' ILIKE :search OR patient.data->>'lastName' ILIKE :search)`
        : ""
    }
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
      ...{ search: search ? `%${search}%` : "" },
      ...{ encounterClass },
    },
    type: QueryTypes.SELECT,
  });

  return parseInt(result[0].count.toString());
}

function constructExternalUrl(
  source: string,
  externalId: string,
  isDisabled: boolean
): string | undefined {
  if (isDisabled) return undefined; // temporarily disabled while waiting for customer to provide actual URL, agreed to disable for now to unblock deployment
  switch (source) {
    case EhrSources.eclinicalworks:
      // dummy url for now, TODO: get feedback and change to the actual url
      return `${ECLINICALWORKS_PATIENT_URL_BASE}/${encodeURIComponent(externalId)}`;
    default:
      return undefined;
  }
}

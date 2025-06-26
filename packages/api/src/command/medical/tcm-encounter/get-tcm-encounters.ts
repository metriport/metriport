import { buildDayjs } from "@metriport/shared/common/date";
import { QueryTypes } from "sequelize";
import { TcmEncounter } from "../../../domain/medical/tcm-encounter";
import { PatientModel } from "../../../models/medical/patient";
import { TcmEncounterModel } from "../../../models/medical/tcm-encounter";
import { Pagination, sortForPagination } from "../../pagination";
import { defaultPageSize } from "../../../shared/sql";

/**
 * Add a default filter date far in the past to guarantee hitting the compound index
 */
const DEFAULT_FILTER_DATE = new Date("2020-01-01T00:00:00.000Z");

export type GetTcmEncountersCmd = {
  cxId: string;
  after?: string;
  pagination: Pagination;
};

export type CountTcmEncountersCmd = {
  cxId: string;
  after?: string;
};

export type TcmEncounterQueryResult = TcmEncounterModel & {
  dataValues: TcmEncounterModel["dataValues"] & {
    patient_data: PatientModel["dataValues"]["data"];
  };
};

type TcmEncounterForDisplay = TcmEncounter & {
  patientName: string;
  patientDateOfBirth: string;
  patientPhoneNumbers: string[];
  patientStates: string[];
};

export async function getTcmEncounters({
  cxId,
  after,
  pagination,
}: GetTcmEncountersCmd): Promise<TcmEncounterForDisplay[]> {
  const encounters = await executeTcmEncountersQuery(pagination, cxId, after);

  const items: TcmEncounterForDisplay[] = encounters.map(row => {
    const { patient_data: patientData, ...encounterData } = row.dataValues;

    return {
      ...encounterData,
      patientName: patientData.firstName + " " + patientData.lastName,
      patientDateOfBirth: patientData.dob,
      patientPhoneNumbers:
        patientData.contact?.flatMap(contact => (contact.phone ? [contact.phone] : [])) ?? [],
      patientStates:
        patientData.address?.flatMap(address => (address.state ? [address.state] : [])) ?? [],
    };
  });

  const sortedItems = sortForPagination(items, pagination);
  return sortedItems;
}

export async function getTcmEncountersCount({
  cxId,
  after,
}: CountTcmEncountersCmd): Promise<number> {
  return await executeTcmEncountersCountQuery(after, cxId);
}

async function executeTcmEncountersQuery(
  pagination: Pagination,
  cxId: string,
  after: string | undefined
): Promise<TcmEncounterQueryResult[]> {
  const sequelize = TcmEncounterModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");
  const { toItem, fromItem, count } = pagination ?? {};

  const queryString = `
    SELECT tcm_encounter.*, patient.data as patient_data
    FROM ${TcmEncounterModel.tableName} tcm_encounter
    INNER JOIN ${PatientModel.tableName} patient ON tcm_encounter.patient_id = patient.id
    WHERE tcm_encounter.cx_id = :cxId
    AND tcm_encounter.admit_time > :afterDate
    ${toItem ? ` AND tcm_encounter.id >= :toItem` : ""}
    ${fromItem ? ` AND tcm_encounter.id <= :fromItem` : ""}
    ORDER BY tcm_encounter.id ${toItem ? "ASC" : "DESC"}
    ${count ? ` LIMIT :count` : ""}
  `;

  return sequelize.query<TcmEncounterQueryResult>(queryString, {
    replacements: {
      cxId,
      ...(toItem ? { toItem } : {}),
      ...(fromItem ? { fromItem } : {}),
      ...(count ? { count } : { count: defaultPageSize }),
      ...{ afterDate: after ? buildDayjs(after).toDate() : DEFAULT_FILTER_DATE },
    },
    type: QueryTypes.SELECT,
  });
}

async function executeTcmEncountersCountQuery(
  after: string | undefined,
  cxId: string
): Promise<number> {
  const sequelize = TcmEncounterModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const queryString = `
    SELECT count(tcm_encounter.id) as count
    FROM ${TcmEncounterModel.tableName} tcm_encounter
    WHERE tcm_encounter.cx_id = :cxId
    AND tcm_encounter.admit_time > :afterDate`;

  const afterDate = after ? buildDayjs(after).toDate() : DEFAULT_FILTER_DATE;

  const result = await sequelize.query<{ count: number }>(queryString, {
    replacements: {
      cxId,
      afterDate,
    },
    type: QueryTypes.SELECT,
  });

  return parseInt(result[0].count.toString());
}

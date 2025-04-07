import { Organization } from "@metriport/core/domain/organization";
import { getStatesFromAddresses, Patient, PatientDemoData } from "@metriport/core/domain/patient";
import { getPatientByDemo as getPatientByDemoMPI } from "@metriport/core/mpi/get-patient-by-demo";
import { NotFoundError, USStateForAddress } from "@metriport/shared";
import { uniq } from "lodash";
import { Op, QueryTypes, Transaction } from "sequelize";
import { Facility } from "../../../domain/medical/facility";
import { PatientMapping, PatientSourceIdentifierMap } from "../../../domain/patient-mapping";
import { PatientLoaderLocal } from "../../../models/helpers/patient-loader-local";
import { PatientModel } from "../../../models/medical/patient";
import { PatientMappingModel, rawToDomain } from "../../../models/patient-mapping";
import { paginationSqlExpressions } from "../../../shared/sql";
import { getPatientMappings, getSourceMapForPatient } from "../../mapping/patient";
import { Pagination, sortForPagination } from "../../pagination";
import { getFacilities } from "../facility/get-facility";
import { getOrganizationOrFail } from "../organization/get-organization";
import { sanitize, validate } from "./shared";

export type PatientMatchCmd = PatientDemoData & { cxId: string };

export type PatientWithIdentifiers = Patient & { additionalIds?: PatientSourceIdentifierMap };

const aliasReplacement = "<patient-alias>";
const mappingsAlias = "mappings";

export async function matchPatient(
  patient: PatientMatchCmd
): Promise<PatientWithIdentifiers | undefined> {
  const { cxId } = patient;

  const sanitized = sanitize(patient);
  validate(sanitized);
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    sanitized;
  const demo: PatientDemoData = {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
  };

  return await getPatientByDemo({ cxId, demo });
}

export async function getPatients({
  cxId,
  patientIds,
  facilityId,
  fullTextSearchFilters,
  pagination,
}: {
  cxId: string;
  patientIds?: string[];
  facilityId?: string;
  fullTextSearchFilters?: string | undefined;
  pagination?: Pagination;
}): Promise<PatientWithIdentifiers[]> {
  const sequelize = PatientModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  /*
   * If/when we move to Sequelize v7 we can replace the raw query with ORM:
   * https://sequelize.org/docs/v7/querying/operators/#tsquery-matching-operator
   */
  const { query: queryFTS, patientAlias } = getPatientsSharedQueryUntilFTS(
    `${aliasReplacement}.*`,
    facilityId,
    patientIds,
    fullTextSearchFilters
  );

  const { query: paginationQueryExpression, replacements: paginationReplacements } =
    paginationSqlExpressions(pagination, patientAlias);
  const queryFinal = queryFTS + paginationQueryExpression;

  const patients = await sequelize.query(queryFinal, {
    model: PatientModel,
    mapToModel: true,
    replacements: {
      cxId,
      ...getPatientsSharedReplacements(facilityId, patientIds, fullTextSearchFilters),
      ...paginationReplacements,
    },
    type: QueryTypes.SELECT,
  });

  const patientAndMappings: { patient: Patient; mappings: PatientMapping[] }[] = patients.map(p => {
    const patient = p.dataValues;
    const mappingsRaw: [] = (patient as any)[mappingsAlias] as []; //eslint-disable-line @typescript-eslint/no-explicit-any
    return {
      patient,
      mappings: mappingsRaw.map(rawToDomain),
    };
  });
  const patientsWithIdentifiers: PatientWithIdentifiers[] = patientAndMappings.map(pm => {
    const additionalIds = getSourceMapForPatient({ mappings: pm.mappings });
    return { ...pm.patient, additionalIds };
  });

  const sortedPatients = sortForPagination(patientsWithIdentifiers, pagination);
  return sortedPatients;
}

export async function getPatientsCount({
  cxId,
  patientIds,
  facilityId,
  fullTextSearchFilters,
}: {
  cxId: string;
  patientIds?: string[];
  facilityId?: string;
  fullTextSearchFilters?: string | undefined;
}): Promise<number> {
  const sequelize = PatientModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const { query: queryFTS } = getPatientsSharedQueryUntilFTS(
    `count(${aliasReplacement}.id)`,
    facilityId,
    patientIds,
    fullTextSearchFilters
  );

  const queryFinal = queryFTS;
  const result = await sequelize.query(queryFinal, {
    replacements: {
      cxId,
      ...getPatientsSharedReplacements(facilityId, patientIds, fullTextSearchFilters),
    },
    type: QueryTypes.SELECT,
  });
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  return parseInt((result[0] as unknown as any).count);
}

function getPatientsSharedQueryUntilFTS(
  selectColumns: string,
  facilityId?: string,
  patientIds?: string[],
  fullTextSearchFilters?: string
): { query: string; patientAlias: string } {
  const alias = "p";
  const querySelect = `SELECT ${selectColumns.replace(aliasReplacement, alias)}, 
  COALESCE(
    jsonb_agg(
      CASE WHEN pm.id IS NOT NULL 
      THEN jsonb_build_object(
        'id', pm.id,
        'external_id', pm.external_id,
        'source', pm.source,
        'created_at', pm.created_at,
        'updated_at', pm.updated_at,
        'version', pm.version
      )
      ELSE NULL END
    ) FILTER (WHERE pm.id IS NOT NULL),
    '[]'::jsonb
  ) as ${mappingsAlias}
  FROM ${PatientModel.tableName} ${alias}
  LEFT OUTER JOIN ${PatientMappingModel.tableName} pm ON ${alias}.id = pm.patient_id
  WHERE ${alias}.cx_id = :cxId`;

  const queryFacility =
    querySelect + (facilityId ? ` AND ${alias}.facility_ids::text[] && :facilityIds::text[]` : "");

  const queryPatientIds = queryFacility + (patientIds ? ` AND ${alias}.id IN (:patientIds)` : "");

  const queryFTS =
    queryPatientIds +
    (fullTextSearchFilters
      ? ` AND (
        ${alias}.search_criteria @@ websearch_to_tsquery('english', :filters) 
        OR ${alias}.external_id ilike '%' || :filters || '%'
        OR ${alias}.id = :filters
        OR ${alias}.id IN (SELECT patient_id FROM patient_mapping WHERE cx_id = :cxId and external_id ilike '%' || :filters || '%')
        OR ${alias}.facility_ids && (SELECT array_agg(id) FROM facility WHERE cx_id = :cxId and (data->>'name' ilike '%' || :filters || '%' or id = :filters))
      )`
      : "");

  const query = queryFTS + ` GROUP BY ${alias}.id `;
  return { query, patientAlias: alias };
}

function getPatientsSharedReplacements(
  facilityId?: string,
  patientIds?: string[],
  fullTextSearchFilters?: string
): Record<string, string | string[]> {
  return {
    ...(facilityId ? { facilityIds: '{"' + [facilityId].join('","') + '"}' } : {}),
    ...(patientIds ? { patientIds } : {}),
    ...(fullTextSearchFilters ? { filters: fullTextSearchFilters } : {}),
  };
}

export async function getPatientIds({
  facilityId,
  cxId,
}: {
  facilityId?: string;
  cxId: string;
}): Promise<string[]> {
  const patients = await PatientModel.findAll({
    attributes: ["id"],
    where: {
      cxId,
      ...(facilityId
        ? {
            facilityIds: {
              [Op.contains]: [facilityId],
            },
          }
        : undefined),
    },
  });
  return patients.map(p => p.dataValues.id);
}

/**
 * Retrieves a patient based on their demographic information. Utilizes functions
 * imported from the MPI core module: normalization, finding(blocking), matching, merging
 * @param cxId - The ID of the patient in the external system.
 * @param demo - The demographic information of the patient.
 * @returns The matched patient object if found, otherwise undefined.
 */
export async function getPatientByDemo({
  cxId,
  demo,
}: {
  cxId: string;
  demo: PatientDemoData;
}): Promise<PatientWithIdentifiers | undefined> {
  const patientLoader = new PatientLoaderLocal();
  const patient = await getPatientByDemoMPI({ cxId, demo, patientLoader });
  return patient ? await attachPatientIdentifiers(patient) : undefined;
}

export type GetPatient = {
  id: string;
  cxId: string;
} & (
  | {
      transaction?: never;
      lock?: never;
    }
  | {
      /**
       * @see executeOnDBTx() for details about the 'transaction' parameter.
       */
      transaction: Transaction;
      /**
       * @see executeOnDBTx() for details about the 'lock' parameter.
       */
      lock?: boolean;
    }
);

/**
 * @see executeOnDBTx() for details about the 'transaction' and 'lock' parameters.
 */
export async function getPatient({
  id,
  cxId,
  transaction,
  lock,
}: GetPatient): Promise<PatientWithIdentifiers | undefined> {
  const patient = await PatientModel.findOne({
    where: { cxId, id },
    transaction,
    lock,
  });
  return patient ? await attachPatientIdentifiers(patient.dataValues, transaction) : undefined;
}

/**
 * @see executeOnDBTx() for details about the 'transaction' and 'lock' parameters.
 */
export async function getPatientOrFail(params: GetPatient): Promise<PatientWithIdentifiers> {
  const patient = await getPatient(params);
  if (!patient) throw new NotFoundError(`Could not find patient`, undefined, { id: params.id });
  return patient;
}

/**
 * @see executeOnDBTx() for details about the 'transaction' and 'lock' parameters.
 */
export async function getPatientModel({
  id,
  cxId,
  transaction,
  lock,
}: GetPatient): Promise<PatientModel | undefined> {
  const patient = await PatientModel.findOne({
    where: { cxId, id },
    transaction,
    lock,
  });
  return patient ?? undefined;
}

/**
 * @see executeOnDBTx() for details about the 'transaction' and 'lock' parameters.
 */
export async function getPatientModelOrFail(params: GetPatient): Promise<PatientModel> {
  const patient = await getPatientModel(params);
  if (!patient) throw new NotFoundError(`Could not find patient`, undefined, { id: params.id });
  return patient;
}

export async function getPatientWithDependencies({
  id,
  cxId,
}: {
  id: string;
  cxId: string;
}): Promise<{
  patient: PatientWithIdentifiers;
  facilities: Facility[];
  organization: Organization;
}> {
  const patient = await getPatientOrFail({ id, cxId });
  const facilities = await getFacilities({ cxId, ids: patient.facilityIds });
  const organization = await getOrganizationOrFail({ cxId });
  return { patient, facilities, organization };
}

export async function getPatientStates({
  cxId,
  patientIds,
}: {
  cxId: string;
  patientIds: string[];
}): Promise<USStateForAddress[]> {
  if (!patientIds || !patientIds.length) return [];
  const patients = await getPatients({ cxId, patientIds });
  const nonUniqueStates = patients.flatMap(getStatesFromAddresses).filter(s => s);
  return uniq(nonUniqueStates);
}

/**
 * Attaches the patient identifiers from the mappings table to the patient object.
 *
 * NOTE: avoid using this function, instead join this column in the DB while querying the patient
 */
export async function attachPatientIdentifiers(
  patient: Patient,
  transaction?: Transaction
): Promise<PatientWithIdentifiers> {
  const mappings = await getPatientMappings(patient, transaction);
  const additionalIds = getSourceMapForPatient({ mappings });
  return {
    ...patient,
    ...(additionalIds ? { additionalIds } : {}),
  };
}

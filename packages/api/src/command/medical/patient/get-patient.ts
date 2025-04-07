import { Organization } from "@metriport/core/domain/organization";
import { getStatesFromAddresses, Patient, PatientDemoData } from "@metriport/core/domain/patient";
import { getPatientByDemo as getPatientByDemoMPI } from "@metriport/core/mpi/get-patient-by-demo";
import { NotFoundError, USStateForAddress } from "@metriport/shared";
import { uniq } from "lodash";
import { Op, QueryTypes, Transaction } from "sequelize";
import { Facility } from "../../../domain/medical/facility";
import { PatientMappingSource, PatientSourceIdentifierMap } from "../../../domain/patient-mapping";
import { PatientLoaderLocal } from "../../../models/helpers/patient-loader-local";
import { PatientModel } from "../../../models/medical/patient";
import { paginationSqlExpressions } from "../../../shared/sql";
import { getPatientMapping, getSourceMapForPatient } from "../../mapping/patient";
import { Pagination, sortForPagination } from "../../pagination";
import { getFacilities } from "../facility/get-facility";
import { getOrganizationOrFail } from "../organization/get-organization";
import { sanitize, validate } from "./shared";

export type PatientMatchCmd = PatientDemoData & { cxId: string };

export type PatientWithIdentifiers = Patient & { additionalIds?: PatientSourceIdentifierMap };

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
  const queryFTS = getPatientsSharedQueryUntilFTS(
    "*",
    facilityId,
    patientIds,
    fullTextSearchFilters
  );

  const { query: paginationQueryExpression, replacements: paginationReplacements } =
    paginationSqlExpressions(pagination);
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

  const patientsWithIdentifiers = await Promise.all(
    patients.map(patient => attachPatientIdentifiers(patient.dataValues))
  );
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

  const queryFTS = getPatientsSharedQueryUntilFTS(
    "count(id)",
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
): string {
  const querySelect = `SELECT ${selectColumns} FROM ${PatientModel.tableName} WHERE cx_id = :cxId `;

  const queryFacility =
    querySelect + (facilityId ? ` AND facility_ids::text[] && :facilityIds::text[]` : "");

  const queryPatientIds = queryFacility + (patientIds ? ` AND id IN (:patientIds)` : "");

  const queryFTS =
    queryPatientIds +
    (fullTextSearchFilters
      ? ` AND (
        search_criteria @@ websearch_to_tsquery('english', :filters) 
        OR external_id ilike '%' || :filters || '%'
        OR id = :filters
        OR id IN (SELECT patient_id FROM patient_mapping WHERE cx_id = :cxId and external_id ilike '%' || :filters || '%')
        OR facility_ids && (SELECT array_agg(id) FROM facility WHERE cx_id = :cxId and (data->>'name' ilike '%' || :filters || '%' or id = :filters))
      )`
      : "");

  return queryFTS;
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
  return patient ? await attachPatientIdentifiers(patient.dataValues) : undefined;
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

export async function getPatientByExternalId({
  cxId,
  externalId,
  source,
}: {
  cxId: string;
  externalId: string;
  source?: PatientMappingSource;
}): Promise<PatientWithIdentifiers | undefined> {
  if (!source) {
    const patient = await PatientModel.findOne({ where: { cxId, externalId } });
    return patient ? await attachPatientIdentifiers(patient.dataValues) : undefined;
  }
  const patientMap = await getPatientMapping({
    cxId,
    externalId,
    source,
  });
  if (!patientMap) return undefined;
  return await getPatientOrFail({ id: patientMap.patientId, cxId });
}

export async function attachPatientIdentifiers(patient: Patient): Promise<PatientWithIdentifiers> {
  const additionalIds = await getSourceMapForPatient({
    cxId: patient.cxId,
    patientId: patient.id,
  });
  return {
    ...patient,
    ...(additionalIds ? { additionalIds } : {}),
  };
}

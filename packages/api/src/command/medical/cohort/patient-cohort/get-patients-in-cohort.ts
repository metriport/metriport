import { Patient } from "@metriport/core/domain/patient";
import { out } from "@metriport/core/util/log";
import { QueryTypes } from "sequelize";
import { PatientModel } from "../../../../models/medical/patient";
import { PatientCohortModel } from "../../../../models/medical/patient-cohort";
import { PatientMappingModel, rawToDomain } from "../../../../models/patient-mapping";
import { getSourceMapForPatient } from "../../../mapping/patient";
import { PaginationV2WithQueryClauses } from "../../../pagination-v2";
import { PatientWithIdentifiers } from "../../patient/get-patient";
import { getCohortModelOrFail } from "../get-cohort";

export type GetPatientsInCohortParams = {
  cohortId: string;
  cxId: string;
  pagination: PaginationV2WithQueryClauses;
};

export type GetPatientsInCohortCountParams = {
  cohortId: string;
  cxId: string;
};

export type PatientQueryData = {
  dataValues: Patient & {
    patient_mappings: Array<{
      external_id: string;
      source: string;
    }>;
  };
};

/**
 * Get patients in a cohort with pagination support.
 *
 * @param cohortId - The ID of the cohort to get patients from.
 * @param cxId - The ID of the CX.
 * @param pagination - Pagination parameters with query clauses.
 * @returns Array of patients in the cohort for the current page.
 */
export async function getPatientsInCohort({
  cohortId,
  cxId,
  pagination,
}: GetPatientsInCohortParams): Promise<PatientWithIdentifiers[]> {
  const { log } = out(`getPatientsInCohort - cx ${cxId}, cohort ${cohortId}`);

  // Verify cohort exists and belongs to the customer
  await getCohortModelOrFail({ id: cohortId, cxId });

  const patientTable = PatientModel.tableName;
  const patientCohortTable = PatientCohortModel.tableName;
  const patientMappingTable = PatientMappingModel.tableName;

  const sequelize = PatientModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const { fromItemClause, toItemClause, orderByClause } = pagination;

  /**
   * ⚠️ Always change this query and the count query together.
   * NOTE: patientMappingTable is included to provide external IDs for patients.
   */
  const queryString = `
      SELECT 
        patient.*,
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
        ) as patient_mappings
      FROM ${patientTable} patient
      INNER JOIN ${patientCohortTable} patient_cohort ON patient.id = patient_cohort.patient_id
      LEFT OUTER JOIN ${patientMappingTable} pm ON patient.id = pm.patient_id
      WHERE patient_cohort.cohort_id = :cohortId
      AND patient.cx_id = :cxId
      ${/* COMPOSITE CURSOR PaginationV2 */ ""}
      ${toItemClause.clause}
      ${fromItemClause.clause}
      GROUP BY patient.id
      ${orderByClause}
      LIMIT :count
    `;

  /**
   * Use a type assertion to cast the additional data from the join into the return type.
   */
  const rawPatients = (await sequelize.query(queryString, {
    model: PatientModel,
    mapToModel: true,
    replacements: {
      cohortId,
      cxId,
      // Include composite cursor parameters
      ...fromItemClause.params,
      ...toItemClause.params,
      count: pagination.count,
    },
    type: QueryTypes.SELECT,
  })) as unknown as PatientQueryData[];

  log(`Found ${rawPatients.length} patients in cohort`);

  const patientsWithIdentifiers = rawPatients.map(p => {
    const { patient_mappings, ...data } = p.dataValues;
    return {
      ...data,
      additionalIds: getSourceMapForPatient({ mappings: patient_mappings.map(rawToDomain) }),
    };
  });

  return patientsWithIdentifiers;
}

/**
 * Get the total count of patients in a cohort.
 *
 * @param cohortId - The ID of the cohort to count patients in.
 * @param cxId - The ID of the CX.
 * @returns Total number of patients in the cohort.
 */
export async function getPatientsInCohortCount({
  cohortId,
  cxId,
}: GetPatientsInCohortCountParams): Promise<number> {
  const patientTable = PatientModel.tableName;
  const patientCohortTable = PatientCohortModel.tableName;

  const sequelize = PatientModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  // Verify cohort exists and belongs to the customer
  await getCohortModelOrFail({ id: cohortId, cxId });

  /**
   * ⚠️ Always change this query and the data query together.
   */
  const queryString = `
    SELECT count(patient.id) as count
    FROM ${patientTable} patient
    INNER JOIN ${patientCohortTable} patient_cohort
    ON patient.id = patient_cohort.patient_id
    WHERE patient_cohort.cohort_id = :cohortId
    AND patient.cx_id = :cxId
  `;

  const result = await sequelize.query(queryString, {
    replacements: {
      cohortId,
      cxId,
    },
    type: QueryTypes.SELECT,
  });

  return parseInt((result[0] as unknown as { count: number }).count.toString());
}

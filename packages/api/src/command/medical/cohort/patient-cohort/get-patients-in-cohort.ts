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

type GetPatientsInCohortCmd = {
  cohortId: string;
  cxId: string;
  pagination: PaginationV2WithQueryClauses;
};

export type PatientQueryData = {
  dataValues: Patient & {
    patient_mappings: Array<{
      id: string;
      patient_id: string;
      cx_id: string;
      external_id: string;
      source: string;
      created_at: string;
      updated_at: string;
      version: string;
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
}: GetPatientsInCohortCmd): Promise<PatientWithIdentifiers[]> {
  const { log } = out(`getPatientsInCohort - cx ${cxId}, cohort ${cohortId}`);

  await getCohortModelOrFail({ cohortId, cxId });

  const patientTable = PatientModel.tableName;
  const patientCohortTable = PatientCohortModel.tableName;
  const patientMappingTable = PatientMappingModel.tableName;

  const sequelize = PatientModel.sequelize;
  if (!sequelize) throw new Error("Sequelize not found");

  const { fromItemClause, toItemClause, orderByClause } = pagination;

  const queryString = `
      WITH patient_mappings AS (
        SELECT 
          patient_id,
          jsonb_agg(
            jsonb_build_object(
              'id', id,
              'patient_id', patient_id,
              'cx_id', cx_id,
              'external_id', external_id,
              'source', source,
              'created_at', created_at,
              'updated_at', updated_at,
              'version', version
            )
          ) as mappings
        FROM ${patientMappingTable}
        WHERE cx_id = :cxId
        GROUP BY patient_id
      )
      SELECT 
        patient.*,
        COALESCE(patient_mappings.mappings, '[]'::jsonb) as patient_mappings
      FROM ${patientTable} patient
      INNER JOIN ${patientCohortTable} patient_cohort ON patient.id = patient_cohort.patient_id
      LEFT JOIN patient_mappings ON patient.id = patient_mappings.patient_id
      WHERE patient_cohort.cohort_id = :cohortId
      AND patient.cx_id = :cxId
      ${/* COMPOSITE CURSOR PaginationV2 */ ""}
      ${toItemClause.clause}
      ${fromItemClause.clause}
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

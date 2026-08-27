import { MetriportError } from "@metriport/shared";
import { QueryTypes } from "sequelize";
import { PatientSettingsModel } from "../../../../models/patient-settings";
import { PaginationV2WithQueryClauses } from "../../../pagination-v2";

export async function getPatientIdsForPatientsWithAdtSubscriptions({
  cxId,
  pagination,
}: {
  cxId: string;
  pagination: PaginationV2WithQueryClauses;
}): Promise<Array<{ id: string }>> {
  const sequelize = PatientSettingsModel.sequelize;
  if (!sequelize) {
    throw new MetriportError("Sequelize instance not available");
  }

  const { fromItemClause, toItemClause, orderByClause } = pagination;
  /*
   * WARNING WHEN CHANGING THIS QUERY, CHANGE THE COUNT ONE ALONG SIDE IT.
   */
  const query = `
      SELECT DISTINCT patient_id as id
      FROM patient_settings ps
      WHERE ps.cx_id = :cxId::uuid
        AND ps.subscriptions IS NOT NULL
        AND ps.subscriptions ? 'adt'
        AND jsonb_array_length(ps.subscriptions->'adt') > 0
        ${toItemClause.clause}
        ${fromItemClause.clause}
        ${orderByClause}
        LIMIT :count
    `;

  const result = await sequelize.query<{ id: string }>(query, {
    replacements: {
      cxId,
      ...fromItemClause.params,
      ...toItemClause.params,
      count: pagination.count,
    },
    type: QueryTypes.SELECT,
  });

  return result;
}

export async function getPatientIdsCountForPatientsWithAdtSubscriptions({
  cxId,
}: {
  cxId: string;
}): Promise<number> {
  const sequelize = PatientSettingsModel.sequelize;
  if (!sequelize) {
    throw new MetriportError("Sequelize instance not available");
  }

  /*
   * WARNING WHEN CHANGING THIS QUERY, CHANGE THE SELECT ONE ALONG SIDE IT.
   */
  const query = `
      SELECT COUNT(DISTINCT patient_id) as count
      FROM patient_settings ps
      WHERE ps.cx_id = :cxId::uuid
        AND ps.subscriptions IS NOT NULL
        AND ps.subscriptions ? 'adt'
        AND jsonb_array_length(ps.subscriptions->'adt') > 0
    `;

  const result = await sequelize.query<{ count: string }>(query, {
    replacements: { cxId },
    type: QueryTypes.SELECT,
  });

  return parseInt(result[0]?.count ?? "0", 10);
}

export async function getPatientIdsForPatientsWithLaboratoryNotifications({
  cxId,
}: {
  cxId: string;
}): Promise<string[]> {
  const sequelize = PatientSettingsModel.sequelize;
  if (!sequelize) {
    throw new MetriportError("Sequelize instance not available");
  }

  const query = `
      SELECT DISTINCT patient_id
      FROM patient_settings ps
      WHERE ps.cx_id = :cxId::uuid
        AND ps.subscriptions IS NOT NULL
        AND ps.subscriptions ? 'questNotifications'
        AND (ps.subscriptions->'questNotifications')::boolean = true
    `;

  const result = await sequelize.query<{ patient_id: string }>(query, {
    replacements: { cxId },
    type: QueryTypes.SELECT,
  });

  return result.map(row => row.patient_id);
}

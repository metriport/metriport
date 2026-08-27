import { DataTypes, QueryTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const tableName = "datasource_query";
const viewName = "network_query_request";

const indexRequestId = `${tableName}_request_id_index`;
const indexPatientSourceStatus = `${tableName}_patient_source_status_index`;
const indexCxIdRequestId = `${tableName}_cx_id_request_id_index`;
const indexCxIdPatientIdRequestId = `${tableName}_cx_id_patient_id_request_id_index`;

/**
 * Creates the datasource query table and network query request view.
 *
 * ## Data Model Overview
 *
 * The `datasource_query` table stores individual queries per data source (hie, pharmacy, lab).
 * Each row represents a query to one data source. Multiple rows share the same requestId to
 * form a complete network query.
 *
 * The `network_query_request` view rolls up those rows by requestId to provide a single
 * "network query" abstraction with:
 * - id: alias for request_id (stable UUID per row)
 * - created_at: earliest creation time across all sources
 * - completed_at: latest completion time across all sources
 * - source_count: number of sources in the request
 * - sources: JSONB array of all source details
 *
 * IMPORTANT: The view does NOT derive status - it only aggregates raw data.
 * All status derivation logic lives in TypeScript to maintain a single source of truth.
 *
 * Example: A request for [hie, lab] creates 2 rows with the same requestId.
 * The view aggregates these into a single network query.
 */

const createViewSql = `
CREATE VIEW ${viewName} AS
SELECT
  request_id AS id,
  request_id,
  cx_id,
  patient_id,
  MIN(created_at) AS created_at,
  CASE
    WHEN bool_and(status IN ('completed', 'failed')) THEN MAX(completed_at)
    ELSE NULL
  END AS completed_at,
  count(*)::int AS source_count,
  jsonb_agg(
    jsonb_build_object(
      'source', source,
      'specificSource', specific_source,
      'status', status,
      'createdAt', created_at,
      'completedAt', completed_at,
      'data', data
    )
    ORDER BY created_at
  ) AS sources
FROM ${tableName}
GROUP BY request_id, cx_id, patient_id;
`;

const dropViewSql = `DROP VIEW IF EXISTS ${viewName};`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      tableName,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
          allowNull: false,
        },
        patientId: {
          type: DataTypes.UUID,
          field: "patient_id",
          allowNull: false,
        },
        requestId: {
          type: DataTypes.UUID,
          field: "request_id",
          allowNull: false,
        },
        source: {
          type: DataTypes.STRING(50),
          field: "source",
          allowNull: false,
        },
        specificSource: {
          type: DataTypes.STRING(100),
          field: "specific_source",
          allowNull: true,
        },
        status: {
          type: DataTypes.STRING(50),
          field: "status",
          allowNull: false,
        },
        completedAt: {
          type: DataTypes.DATE(6),
          field: "completed_at",
          allowNull: true,
        },
        data: {
          type: DataTypes.JSONB,
          field: "data",
          allowNull: true,
        },
      },
      { transaction, addVersion: true }
    );

    // Index for aggregating rows by requestId
    await queryInterface.addIndex(tableName, {
      name: indexRequestId,
      fields: ["request_id"],
      transaction,
    });

    // Index for patient + source lookups and filtering by status
    // Also covers (cx_id, patient_id, source) queries via left-prefix
    await queryInterface.addIndex(tableName, {
      name: indexPatientSourceStatus,
      fields: ["cx_id", "patient_id", "source", "status"],
      transaction,
    });

    // Index for cx_id + request_id lookups (efficient customer-level queries)
    await queryInterface.addIndex(tableName, {
      name: indexCxIdRequestId,
      fields: ["cx_id", "request_id"],
      transaction,
    });

    // Index for cx_id + patient_id + request_id lookups (efficient patient-level queries)
    await queryInterface.addIndex(tableName, {
      name: indexCxIdPatientIdRequestId,
      fields: ["cx_id", "patient_id", "request_id"],
      transaction,
    });

    // Create the view
    await queryInterface.sequelize.query(createViewSql, {
      type: QueryTypes.RAW,
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(dropViewSql, {
      type: QueryTypes.RAW,
      transaction,
    });

    await queryInterface.removeIndex(tableName, indexCxIdPatientIdRequestId, { transaction });
    await queryInterface.removeIndex(tableName, indexCxIdRequestId, { transaction });
    await queryInterface.removeIndex(tableName, indexPatientSourceStatus, { transaction });
    await queryInterface.removeIndex(tableName, indexRequestId, { transaction });
    await queryInterface.dropTable(tableName, { transaction });
  });
};

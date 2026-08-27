import { DataTypes, QueryTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "datasource_query";
const tempTableName = "datasource_query_new";
const viewName = "network_query_request";

const indexRequestId = `${tableName}_request_id_index`;
const indexPatientSourceStatus = `${tableName}_patient_source_status_index`;
const indexCxIdRequestId = `${tableName}_cx_id_request_id_index`;
const indexCxIdPatientIdRequestId = `${tableName}_cx_id_patient_id_request_id_index`;

/**
 * Adds status_changed_at column and reorders columns for better readability.
 *
 * PostgreSQL doesn't support column reordering, so we recreate the table with:
 * 1. New column order: id, source, specific_source, status, data, status_changed_at, ...
 * 2. New status_changed_at column (defaults to created_at for existing rows)
 *
 * The view is also updated to include status_changed_at in the sources JSONB.
 */

const dropViewSql = `DROP VIEW IF EXISTS ${viewName};`;

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
      'statusChangedAt', status_changed_at,
      'data', data
    )
    ORDER BY created_at
  ) AS sources
FROM ${tableName}
GROUP BY request_id, cx_id, patient_id;
`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    // Drop the view first (it depends on the table)
    await queryInterface.sequelize.query(dropViewSql, {
      type: QueryTypes.RAW,
      transaction,
    });

    // Create new table with desired column order
    await queryInterface.createTable(
      tempTableName,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
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
        data: {
          type: DataTypes.JSONB,
          field: "data",
          allowNull: true,
        },
        statusChangedAt: {
          type: DataTypes.DATE(6),
          field: "status_changed_at",
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
        completedAt: {
          type: DataTypes.DATE(6),
          field: "completed_at",
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE(6),
          field: "created_at",
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE(6),
          field: "updated_at",
          allowNull: false,
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
      },
      { transaction }
    );

    // Copy data from old table to new table, using created_at as default for status_changed_at
    await queryInterface.sequelize.query(
      `INSERT INTO ${tempTableName} (
        id, source, specific_source, status, data, status_changed_at,
        cx_id, patient_id, request_id, completed_at, created_at, updated_at, version
      )
      SELECT
        id, source, specific_source, status, data, created_at as status_changed_at,
        cx_id, patient_id, request_id, completed_at, created_at, updated_at, version
      FROM ${tableName}`,
      { type: QueryTypes.RAW, transaction }
    );

    // Drop old table
    await queryInterface.dropTable(tableName, { transaction });

    // Rename new table to original name
    await queryInterface.renameTable(tempTableName, tableName, { transaction });

    // Recreate indexes
    await queryInterface.addIndex(tableName, {
      name: indexRequestId,
      fields: ["request_id"],
      transaction,
    });

    await queryInterface.addIndex(tableName, {
      name: indexPatientSourceStatus,
      fields: ["cx_id", "patient_id", "source", "status"],
      transaction,
    });

    await queryInterface.addIndex(tableName, {
      name: indexCxIdRequestId,
      fields: ["cx_id", "request_id"],
      transaction,
    });

    await queryInterface.addIndex(tableName, {
      name: indexCxIdPatientIdRequestId,
      fields: ["cx_id", "patient_id", "request_id"],
      transaction,
    });

    // Recreate the updated_at trigger
    await queryInterface.createTrigger(
      tableName,
      `trg_update_${tableName}`,
      "before",
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore - https://github.com/sequelize/sequelize/issues/11420
      { before: "update" },
      "update_trigger_fn",
      [],
      ["FOR EACH ROW"],
      { transaction }
    );

    // Recreate the view with status_changed_at included
    await queryInterface.sequelize.query(createViewSql, {
      type: QueryTypes.RAW,
      transaction,
    });
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    // Drop the view
    await queryInterface.sequelize.query(dropViewSql, {
      type: QueryTypes.RAW,
      transaction,
    });

    // Remove status_changed_at column
    await queryInterface.removeColumn(tableName, "status_changed_at", { transaction });

    // Recreate the original view without status_changed_at
    const originalViewSql = `
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
    await queryInterface.sequelize.query(originalViewSql, {
      type: QueryTypes.RAW,
      transaction,
    });
  });
};

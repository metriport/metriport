import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

const documentQueryTableName = "document_query";
const documentQueryTableConstraintName = "document_query_requestId_cxId_patientId_constraint";
const documentQueryTableIdFields = ["request_id", "cx_id", "patient_id"];

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      documentQueryTableName,
      {
        id: {
          type: DataTypes.UUID,
          primaryKey: true,
          allowNull: false,
        },
        requestId: {
          type: DataTypes.UUID,
          field: "request_id",
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
        isReconvert: {
          type: DataTypes.BOOLEAN,
          field: "is_reconvert",
          allowNull: false,
          defaultValue: false,
        },
        isDownloadWebhookSent: {
          type: DataTypes.BOOLEAN,
          field: "is_download_webhook_sent",
          allowNull: false,
          defaultValue: false,
        },
        isConvertWebhookSent: {
          type: DataTypes.BOOLEAN,
          field: "is_convert_webhook_sent",
          allowNull: false,
          defaultValue: false,
        },
        metaData: {
          type: DataTypes.JSONB,
          field: "metadata",
          allowNull: true,
          defaultValue: null,
        },
        data: {
          type: DataTypes.JSONB,
          field: "data",
          allowNull: true,
          defaultValue: null,
        },
        ...createCommonwellTable("commonwell", "Download"),
        ...createCommonwellTable("commonwell", "Convert"),
        ...createCommonwellTable("carequality", "Download"),
        ...createCommonwellTable("carequality", "Convert"),
      },
      { transaction, addVersion: true }
    );
    await queryInterface.addConstraint(documentQueryTableName, {
      name: documentQueryTableConstraintName,
      fields: documentQueryTableIdFields,
      type: "unique",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(
      documentQueryTableName,
      documentQueryTableConstraintName,
      {
        transaction,
      }
    );
    await queryInterface.dropTable(documentQueryTableName, { transaction });
  });
};

function createCommonwellTable(hie: string, step: "Convert" | "Download" | "Unknown") {
  const stepLower = step.toLowerCase();
  return {
    [`${hie}${step}Error`]: {
      type: DataTypes.INTEGER,
      field: `${hie}_${stepLower}_error`,
      allowNull: false,
      defaultValue: 0,
    },
    [`${hie}${step}Success`]: {
      type: DataTypes.INTEGER,
      field: `${hie}_${stepLower}_success`,
      allowNull: false,
      defaultValue: 0,
    },
    [`${hie}${step}Total`]: {
      type: DataTypes.INTEGER,
      field: `${hie}_${stepLower}_total`,
      allowNull: false,
      defaultValue: 0,
    },
    [`${hie}${step}Status`]: {
      type: DataTypes.STRING,
      field: `${hie}_${stepLower}_status`,
      allowNull: true,
      defaultValue: null,
    },
  };
}

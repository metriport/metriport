import { DataTypes } from "sequelize";
import type { Migration } from "..";
import * as shared from "../migrations-shared";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      "organization",
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
        },
        organizationNumber: {
          type: DataTypes.INTEGER,
          field: "organization_number",
          unique: true,
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      { transaction }
    );

    await shared.createTable(
      queryInterface,
      "facility",
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
        },
        facilityNumber: {
          type: DataTypes.INTEGER,
          field: "facility_number",
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      { transaction, uniqueKeys: { facility_unique: { fields: ["cx_id", "facility_number"] } } }
    );

    await shared.createTable(
      queryInterface,
      "patient",
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
        },
        facilityIds: {
          type: DataTypes.ARRAY(DataTypes.STRING),
          field: "facility_ids",
        },
        patientNumber: {
          type: DataTypes.INTEGER,
          field: "patient_number",
        },
        data: {
          type: DataTypes.JSONB,
        },
      },
      { transaction, uniqueKeys: { facility_unique: { fields: ["cx_id", "patient_number"] } } }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable("patient", { transaction });
    await queryInterface.dropTable("facility", { transaction });
    await queryInterface.dropTable("organization", { transaction });
  });
};

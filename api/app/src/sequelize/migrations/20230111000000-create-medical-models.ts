import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { Facility } from "../../models/medical/facility";
import { Organization } from "../../models/medical/organization";
import { Patient } from "../../models/medical/patient";
import * as shared from "../migrations-shared";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(
      queryInterface,
      Organization.NAME,
      {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
        cxId: {
          type: DataTypes.UUID,
          field: "cx_id",
        },
        organizationId: {
          type: DataTypes.INTEGER,
          field: "organization_id",
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
      Facility.NAME,
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
      Patient.NAME,
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
          type: DataTypes.ARRAY(DataTypes.INTEGER),
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
    await queryInterface.dropTable(Patient.NAME, { transaction });
    await queryInterface.dropTable(Facility.NAME, { transaction });
    await queryInterface.dropTable(Organization.NAME, { transaction });
  });
};

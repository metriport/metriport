import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { Facility } from "../../models/medical/facility";
import { Organization } from "../../models/medical/organization";
import { Patient } from "../../models/medical/patient";
import * as shared from "../migrations-shared";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(queryInterface, transaction, Organization.NAME, {
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
    });

    await shared.createTable(queryInterface, transaction, Facility.NAME, {
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
        references: { model: Organization.NAME, key: "organization_id" },
      },
      facilityId: {
        type: DataTypes.INTEGER,
        field: "facility_id",
      },
      data: {
        type: DataTypes.JSONB,
      },
    });
    // a raw query is necessary here as doing composite unique keys through sequelize doesn't work
    await queryInterface.sequelize.query(
      `ALTER TABLE facility ADD UNIQUE (organization_id, facility_id);`,
      { transaction }
    );

    await shared.createTable(queryInterface, transaction, Patient.NAME, {
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
        references: { model: Organization.NAME, key: "organization_id" },
      },
      facilityIds: {
        type: DataTypes.ARRAY(DataTypes.INTEGER),
        field: "facility_ids",
      },
      patientId: {
        type: DataTypes.INTEGER,
        field: "patient_id",
      },
      data: {
        type: DataTypes.JSONB,
      },
    });
    await queryInterface.sequelize.query(
      `ALTER TABLE patient ADD UNIQUE (organization_id, patient_id);`,
      { transaction }
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

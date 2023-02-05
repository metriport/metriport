import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { Facility } from "../../models/medical/facility";
import { Organization } from "../../models/medical/organization";
import * as shared from "../migrations-shared";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await shared.createTable(queryInterface, transaction, Organization.NAME, {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      systemRootOid: {
        type: DataTypes.STRING,
        primaryKey: true,
        field: "system_root_oid",
      },
    });
    await shared.createTable(queryInterface, transaction, Facility.NAME, {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
      },
      organizationId: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        field: "organization_id",
      },
      systemRootOid: {
        type: DataTypes.STRING,
        primaryKey: true,
        field: "system_root_oid",
      },
    });
    // a raw query is necessary here as sequelize doesn't support composite FKs
    await queryInterface.sequelize.query(
      `ALTER TABLE facility ADD CONSTRAINT fk_facility_organization FOREIGN KEY (organization_id, system_root_oid) REFERENCES organization (id, system_root_oid);`,
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTable(Facility.NAME, { transaction });
    await queryInterface.dropTable(Organization.NAME, { transaction });
  });
};

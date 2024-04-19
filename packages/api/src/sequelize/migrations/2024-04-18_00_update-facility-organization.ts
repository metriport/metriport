import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { FacilityType } from "../../models/medical/facility";
import { OrganizationType } from "../../models/medical/organization";

const facilityTableName = "facility";
const organizationTableName = "organization";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      facilityTableName,
      "oid",
      { type: DataTypes.STRING },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "facility_number",
      { type: DataTypes.NUMBER },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cq_obo_active",
      { type: DataTypes.BOOLEAN, defaultValue: false },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cw_obo_active",
      { type: DataTypes.BOOLEAN, defaultValue: false },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cq_obo_oid",
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "cw_obo_oid",
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      "type",
      {
        type: DataTypes.ENUM(...Object.values(FacilityType)),
        defaultValue: FacilityType.initiatorAndResponder,
      },
      { transaction }
    );
    await queryInterface.addColumn(
      organizationTableName,
      "type",
      {
        type: DataTypes.ENUM(...Object.values(OrganizationType)),
        defaultValue: OrganizationType.healthcareProvider,
      },
      { transaction }
    );
    // TODO: need to write update query to generate OIDs on existing facilities
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(organizationTableName, "type", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "type", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cw_obo_oid", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cq_obo_oid", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cw_obo_active", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "cq_obo_active", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "facility_number", {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, "oid", {
      transaction,
    });
  });
};

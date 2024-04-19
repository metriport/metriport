import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { FacilityModel, FacilityType } from "../../models/medical/facility";
import { OrganizationModel, OrganizationType } from "../../models/medical/organization";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      FacilityModel.NAME,
      "oid",
      { type: DataTypes.STRING },
      { transaction }
    );
    await queryInterface.addColumn(
      FacilityModel.NAME,
      "facility_number",
      { type: DataTypes.NUMBER },
      { transaction }
    );
    await queryInterface.addColumn(
      FacilityModel.NAME,
      "cq_obo_active",
      { type: DataTypes.BOOLEAN, defaultValue: false },
      { transaction }
    );
    await queryInterface.addColumn(
      FacilityModel.NAME,
      "cw_obo_active",
      { type: DataTypes.BOOLEAN, defaultValue: false },
      { transaction }
    );
    await queryInterface.addColumn(
      FacilityModel.NAME,
      "cq_obo_oid",
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      FacilityModel.NAME,
      "cw_obo_oid",
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      FacilityModel.NAME,
      "type",
      {
        type: DataTypes.ENUM(...Object.values(FacilityType)),
        defaultValue: FacilityType.initiatorAndResponder,
      },
      { transaction }
    );
    await queryInterface.addColumn(
      OrganizationModel.NAME,
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
    await queryInterface.removeColumn(FacilityModel.NAME, "type", {
      transaction,
    });
    await queryInterface.removeColumn(FacilityModel.NAME, "cw_obo_oid", {
      transaction,
    });
    await queryInterface.removeColumn(FacilityModel.NAME, "cq_obo_oid", {
      transaction,
    });
    await queryInterface.removeColumn(FacilityModel.NAME, "cw_obo_active", {
      transaction,
    });
    await queryInterface.removeColumn(FacilityModel.NAME, "cq_obo_active", {
      transaction,
    });
    await queryInterface.removeColumn(FacilityModel.NAME, "facility_number", {
      transaction,
    });
    await queryInterface.removeColumn(FacilityModel.NAME, "oid", {
      transaction,
    });
  });
};

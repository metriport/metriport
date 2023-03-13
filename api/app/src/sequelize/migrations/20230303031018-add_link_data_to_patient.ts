import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { Settings } from "../../models/settings";
import { Patient } from "../../models/medical/patient";

// Use 'Promise.all' when changes are independent of each other
// Docs: https://sequelize.org/api/v6/class/src/dialects/abstract/query-interface.js~queryinterface
export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      Patient.NAME,
      "link_data",
      { type: DataTypes.JSONB },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(Settings.NAME, "link_data", {
      transaction,
    });
  });
};

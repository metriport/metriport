import { DataTypes } from "sequelize";
import type { Migration } from "..";

const patientTableName = "patient";
const hieOptOutColumn = "hie_opt_out";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      patientTableName,
      hieOptOutColumn,
      { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(patientTableName, hieOptOutColumn, {
      transaction,
    });
  });
};

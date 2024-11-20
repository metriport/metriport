import { DataTypes } from "sequelize";
import type { Migration } from "..";

const patientTableName = "patient";
const optingOutColumn = "opting_out";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      patientTableName,
      optingOutColumn,
      { type: DataTypes.BOOLEAN, defaultValue: false },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(patientTableName, optingOutColumn, {
      transaction,
    });
  });
};

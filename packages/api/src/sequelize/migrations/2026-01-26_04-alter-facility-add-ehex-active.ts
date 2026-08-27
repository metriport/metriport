import { DataTypes } from "sequelize";
import type { Migration } from "..";

const facilityTableName = "facility";
const ehexActiveColumn = "ehex_active";
const ehexApprovedColumn = "ehex_approved";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      facilityTableName,
      ehexActiveColumn,
      {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      { transaction }
    );
    await queryInterface.addColumn(
      facilityTableName,
      ehexApprovedColumn,
      {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(facilityTableName, ehexApprovedColumn, {
      transaction,
    });
    await queryInterface.removeColumn(facilityTableName, ehexActiveColumn, {
      transaction,
    });
  });
};

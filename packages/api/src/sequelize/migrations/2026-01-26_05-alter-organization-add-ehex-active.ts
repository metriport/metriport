import { DataTypes } from "sequelize";
import type { Migration } from "..";

const organizationTableName = "organization";
const ehexActiveColumn = "ehex_active";
const ehexApprovedColumn = "ehex_approved";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      organizationTableName,
      ehexActiveColumn,
      {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      { transaction }
    );
    await queryInterface.addColumn(
      organizationTableName,
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
    await queryInterface.removeColumn(organizationTableName, ehexApprovedColumn, {
      transaction,
    });
    await queryInterface.removeColumn(organizationTableName, ehexActiveColumn, {
      transaction,
    });
  });
};

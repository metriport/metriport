import { DataTypes } from "sequelize";
import type { Migration } from "..";

const organizationTableName = "organization";
const delegateOidsColumn = "delegate_oids";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      organizationTableName,
      delegateOidsColumn,
      {
        type: DataTypes.ARRAY(DataTypes.STRING),
        defaultValue: [],
        allowNull: false,
      },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(organizationTableName, delegateOidsColumn, {
      transaction,
    });
  });
};

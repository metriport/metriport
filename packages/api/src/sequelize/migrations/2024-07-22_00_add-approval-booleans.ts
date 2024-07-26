import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableNameOrganization = "organization";
const tableNameFacility = "facility";
const cqApprovedolumn = "cq_approved";
const cwApprovedColumn = "cw_approved";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableNameOrganization,
      cqApprovedolumn,
      { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      { transaction }
    );
    await queryInterface.addColumn(
      tableNameOrganization,
      cwApprovedColumn,
      { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      { transaction }
    );
    await queryInterface.addColumn(
      tableNameFacility,
      cqApprovedolumn,
      { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      { transaction }
    );
    await queryInterface.addColumn(
      tableNameFacility,
      cwApprovedColumn,
      { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableNameFacility, cwApprovedColumn, { transaction });
    await queryInterface.removeColumn(tableNameFacility, cqApprovedolumn, { transaction });
    await queryInterface.removeColumn(tableNameOrganization, cwApprovedColumn, { transaction });
    await queryInterface.removeColumn(tableNameOrganization, cqApprovedolumn, { transaction });
  });
};

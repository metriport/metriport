import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cq_directory_entry";
const gatewayColumn = "gateway";
const managingOrgColumn = "managing_organization";
const activeColumn = "active";
const columnToChange = "url_xcpd";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      gatewayColumn,
      { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      managingOrgColumn,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      activeColumn,
      { type: DataTypes.BOOLEAN, allowNull: false },
      { transaction }
    );
    await queryInterface.changeColumn(
      tableName,
      columnToChange,
      {
        type: DataTypes.STRING,
        allowNull: true,
      },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, gatewayColumn, { transaction });
    await queryInterface.removeColumn(tableName, managingOrgColumn, { transaction });
    await queryInterface.removeColumn(tableName, activeColumn, { transaction });
    await queryInterface.changeColumn(
      tableName,
      columnToChange,
      {
        type: DataTypes.STRING,
        allowNull: false,
      },
      { transaction }
    );
  });
};

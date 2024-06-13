import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "settings";
const whUrl = "webhook_url";
const whStatusDetail = "webhook_status_detail";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      tableName,
      whUrl,
      { type: DataTypes.STRING(2048), allowNull: true },
      { transaction }
    );
    await queryInterface.changeColumn(
      tableName,
      whStatusDetail,
      { type: DataTypes.STRING(2048), allowNull: true },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      tableName,
      whStatusDetail,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.changeColumn(
      tableName,
      whUrl,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
  });
};

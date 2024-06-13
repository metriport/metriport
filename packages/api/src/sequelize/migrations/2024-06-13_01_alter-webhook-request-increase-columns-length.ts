import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "webhook_request";
const requestUrl = "request_url";
const statusDetail = "status_detail";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      tableName,
      requestUrl,
      { type: DataTypes.STRING(2048), allowNull: true },
      { transaction }
    );
    await queryInterface.changeColumn(
      tableName,
      statusDetail,
      { type: DataTypes.STRING(2048), allowNull: true },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      tableName,
      statusDetail,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.changeColumn(
      tableName,
      requestUrl,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
  });
};

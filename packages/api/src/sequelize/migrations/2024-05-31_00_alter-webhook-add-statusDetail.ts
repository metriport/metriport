import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "webhook_request";
const typeColumn = "type";
const statusDetail = "status_detail";
const requestUrl = "request_url";
const httpStatus = "http_status";
const durationMillis = "duration_millis";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      tableName,
      typeColumn,
      { type: DataTypes.STRING, allowNull: false },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      statusDetail,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      requestUrl,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      httpStatus,
      { type: DataTypes.INTEGER, allowNull: true },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      durationMillis,
      { type: DataTypes.INTEGER, allowNull: true },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, durationMillis, { transaction });
    await queryInterface.removeColumn(tableName, httpStatus, { transaction });
    await queryInterface.removeColumn(tableName, requestUrl, { transaction });
    await queryInterface.removeColumn(tableName, statusDetail, { transaction });
    await queryInterface.changeColumn(
      tableName,
      typeColumn,
      { type: DataTypes.STRING, allowNull: true },
      { transaction }
    );
  });
};

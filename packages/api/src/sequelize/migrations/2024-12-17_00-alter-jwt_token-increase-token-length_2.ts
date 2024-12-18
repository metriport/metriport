import { DataTypes } from "sequelize";
import type { Migration } from "..";

const jwtTokenTableName = "jwt_token";
const jwtTokenColumnName = "token";

export const up: Migration = async ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      jwtTokenTableName,
      jwtTokenColumnName,
      { type: DataTypes.STRING(4096) },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.changeColumn(
      jwtTokenTableName,
      jwtTokenColumnName,
      { type: DataTypes.STRING(1024) },
      { transaction }
    );
  });
};

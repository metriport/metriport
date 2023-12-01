import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "cq_directory_entry";
// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      "lat_temp",
      { type: DataTypes.FLOAT },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      "lon_temp",
      { type: DataTypes.FLOAT },
      { transaction }
    );
    await queryInterface.sequelize.query(
      `UPDATE ${tableName} SET lat_temp = CAST(lat AS FLOAT), lon_temp = CAST(lon AS FLOAT)`,
      { transaction }
    );
    await queryInterface.removeColumn(tableName, "lat", { transaction });
    await queryInterface.removeColumn(tableName, "lon", { transaction });

    await queryInterface.renameColumn(tableName, "lat_temp", "lat", { transaction });
    await queryInterface.renameColumn(tableName, "lon_temp", "lon", { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      "lat_temp",
      { type: DataTypes.STRING },
      { transaction }
    );
    await queryInterface.addColumn(
      tableName,
      "lon_temp",
      { type: DataTypes.STRING },
      { transaction }
    );

    await queryInterface.sequelize.query(
      `UPDATE ${tableName} SET lat_temp =  CAST(lat AS TEXT), lon_temp = CAST(lon AS TEXT)`,
      { transaction }
    );
    await queryInterface.removeColumn(tableName, "lat", { transaction });
    await queryInterface.removeColumn(tableName, "lon", { transaction });

    await queryInterface.renameColumn(tableName, "lat_temp", "lat", { transaction });
    await queryInterface.renameColumn(tableName, "lon_temp", "lon", { transaction });
  });
};

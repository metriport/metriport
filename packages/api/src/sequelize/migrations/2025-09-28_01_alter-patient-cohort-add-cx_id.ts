import { DataTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "patient_cohort";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      "cx_id",
      {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: "organization",
          key: "cx_id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      { transaction }
    );
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, "cx_id", { transaction });
  });
};

import { DataTypes } from "sequelize";
import type { Migration } from "..";

const cxMappingTableName = "cx_mapping";
const cohortTableName = "cohort";
const columnName = "default_cohort_id";
const constraintName = `${cxMappingTableName}_${columnName}_fkey`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      cxMappingTableName,
      columnName,
      { type: DataTypes.UUID, allowNull: true },
      { transaction }
    );

    await queryInterface.addConstraint(cxMappingTableName, {
      fields: [columnName],
      type: "foreign key",
      name: constraintName,
      references: {
        table: cohortTableName,
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(cxMappingTableName, constraintName, {
      transaction,
    });
    await queryInterface.removeColumn(cxMappingTableName, columnName, { transaction });
  });
};

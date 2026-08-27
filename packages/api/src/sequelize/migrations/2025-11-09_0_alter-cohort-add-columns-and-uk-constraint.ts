import { DataTypes } from "sequelize";
import type { Migration } from "..";
import { DEFAULT_COLOR } from "@metriport/shared/domain/cohort";

const cohortTableName = "cohort";
const nameColumnName = "name";
const cxIdColumnName = "cx_id";
const uniqueConstraintFields = [cxIdColumnName, nameColumnName];
const uniqueConstraintName = `uk_${cohortTableName}_${cxIdColumnName}_${nameColumnName}`;

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      cohortTableName,
      "description",
      {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: "",
      },
      { transaction }
    );

    await queryInterface.addColumn(
      cohortTableName,
      "color",
      {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: DEFAULT_COLOR,
      },
      { transaction }
    );

    await queryInterface.addColumn(
      cohortTableName,
      "settings",
      {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      { transaction }
    );

    await queryInterface.addConstraint(cohortTableName, {
      fields: uniqueConstraintFields,
      type: "unique",
      name: uniqueConstraintName,
      transaction,
    });

    await queryInterface.removeColumn(cohortTableName, "monitoring", { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      cohortTableName,
      "monitoring",
      {
        type: DataTypes.JSONB,
        allowNull: true,
      },
      { transaction }
    );

    await queryInterface.removeConstraint(cohortTableName, uniqueConstraintName, { transaction });
    await queryInterface.removeColumn(cohortTableName, "settings", { transaction });
    await queryInterface.removeColumn(cohortTableName, "color", { transaction });
    await queryInterface.removeColumn(cohortTableName, "description", { transaction });
  });
};

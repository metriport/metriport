import { DataTypes, Sequelize } from "sequelize";
import type { Migration } from "..";

const tableName = "tcm_encounter";
const columnName = "outreach_logs";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addColumn(
      tableName,
      columnName,
      {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: Sequelize.literal(`'[]'::jsonb`),
      },
      { transaction }
    );
    await queryInterface.sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_tcm_encounter_outreach_logs ON ${tableName} USING gin (${columnName});`,
      { transaction }
    );
  });
};

export const down: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, columnName, { transaction });
    await queryInterface.sequelize.query(`DROP INDEX IF EXISTS idx_tcm_encounter_outreach_logs;`, {
      transaction,
    });
  });
};

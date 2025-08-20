import type { Migration } from "..";

const tableName = "tcm_encounter";
const columnName = "last_outreach_date";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(
      `
      ALTER TABLE ${tableName} 
      ADD COLUMN ${columnName} TIMESTAMPTZ;
      `,
      { transaction }
    );
  });

  await queryInterface.sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_tcm_encounter_last_outreach_date 
      ON ${tableName} (${columnName}) 
      WHERE ${columnName} IS NOT NULL;
  `);
};

export const down: Migration = async ({ context: queryInterface }) => {
  // Drop the index outside of transaction
  await queryInterface.sequelize.query(
    `DROP INDEX IF EXISTS idx_tcm_encounter_last_outreach_date;`
  );

  // Remove the column
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, columnName, { transaction });
  });
};

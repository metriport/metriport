import type { Migration } from "..";
import { cardiacCodes } from "../../command/medical/tcm-encounter/cardiac-codes";

const tableName = "tcm_encounter";
const columnName = "has_cardiac_code";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    // Add generated column that automatically computes cardiac code presence
    await queryInterface.sequelize.query(
      `
      ALTER TABLE ${tableName} 
      ADD COLUMN ${columnName} BOOLEAN 
      GENERATED ALWAYS AS (
        jsonb_path_query_array(clinical_information, '$.condition[*].coding[*].code')
        ?| ARRAY['${cardiacCodes.join("', '")}']
      ) STORED;
      `,
      { transaction }
    );
  });

  // Create index outside transaction (CONCURRENTLY cannot run inside transaction)
  await queryInterface.sequelize.query(`
    CREATE INDEX CONCURRENTLY idx_tcm_encounter_cardiac_code 
      ON ${tableName} (${columnName}) 
      WHERE ${columnName} = true;
  `);
};

export const down: Migration = async ({ context: queryInterface }) => {
  // Drop the index outside of transaction
  await queryInterface.sequelize.query(
    `DROP INDEX CONCURRENTLY IF EXISTS idx_tcm_encounter_cardiac_code;`
  );

  // Remove the column
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeColumn(tableName, columnName, { transaction });
  });
};

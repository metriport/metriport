import type { Migration } from "..";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS cube;`, { transaction });
    await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS earthdistance;`, {
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(`DROP EXTENSION IF EXISTS cube;`, { transaction });
    await queryInterface.sequelize.query(`DROP EXTENSION IF EXISTS earthdistance;`, {
      transaction,
    });
  });
};

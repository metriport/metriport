import type { Migration } from "..";

const tableName = "organization";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.addConstraint(tableName, {
      fields: ["cx_id"],
      type: "unique",
      name: `uk_${tableName}_cx_id`,
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeConstraint(tableName, `uk_${tableName}_cx_id`, { transaction });
  });
};

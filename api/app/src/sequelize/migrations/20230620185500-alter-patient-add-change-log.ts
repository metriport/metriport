import type { Migration } from "..";

const tableName = "patient";
const triggerName = "change_log";

function getChangeTriggerCreateCmd(): string {
  return (
    `CREATE TRIGGER ${triggerName} ` +
    `AFTER INSERT OR UPDATE OR DELETE ` +
    `ON ${tableName} FOR EACH ROW ` +
    `EXECUTE PROCEDURE change_trigger();`
  );
}

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(getChangeTriggerCreateCmd(), { transaction });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.dropTrigger(tableName, triggerName, { transaction });
  });
};

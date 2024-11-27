import { QueryTypes } from "sequelize";
import type { Migration } from "..";

const tableName = "patient";
const columnName = "search_criteria";
const indexName = "search_criteria_index";

// Use 'Promise.all' when changes are independent of each other
export const up: Migration = async ({ context: queryInterface }) => {
  const createGeneratedColumn = `
alter table ${tableName}
add ${columnName} tsvector 
generated always as	(
	to_tsvector('english', coalesce(id, '')) || ' ' || 
	to_tsvector('english', coalesce(external_id, '')) || ' ' || 
	to_tsvector('english', coalesce(data->>'lastName', '')) || ' ' || 
	to_tsvector('english', coalesce(data->>'firstName', '')) || ' ' || 
	to_tsvector('english', coalesce(SUBSTRING(data->>'dob',1,4), '')) || ' ' ||
	to_tsvector('english', coalesce(SUBSTRING(immutable_replace(data->>'dob', '-', ''),1,6), '')) || ' ' ||
	to_tsvector('english', coalesce(data->>'dob', '')) || ' ' ||
	to_tsvector('english', coalesce(immutable_replace(data->>'dob', '-', ''), '')) :: tsvector
) stored;
`;
  await queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.sequelize.query(createGeneratedColumn, {
      type: QueryTypes.RAW,
      transaction,
    });
    await queryInterface.addIndex(tableName, {
      name: indexName,
      fields: [columnName],
      using: "GIN",
      transaction,
    });
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await queryInterface.removeIndex(tableName, indexName, { transaction });
    await queryInterface.removeColumn(tableName, columnName, { transaction });
  });
};

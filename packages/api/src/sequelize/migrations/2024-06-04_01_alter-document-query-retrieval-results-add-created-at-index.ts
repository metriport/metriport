import type { Migration } from "..";

const documentQueryResultTable = "document_query_result";
const documentRetrievalResultTable = "document_retrieval_result";

const createdAtIndex = "createdat_index";
const createdAtIndexFieldName = "created_at";

export const up: Migration = async ({ context: queryInterface }) => {
  await queryInterface.sequelize.transaction(async transaction => {
    await Promise.all([
      queryInterface.addIndex(documentQueryResultTable, {
        name: `${documentQueryResultTable}_${createdAtIndex}`,
        fields: [
          {
            name: createdAtIndexFieldName,
            order: "DESC",
          },
        ],
        transaction,
      }),
      queryInterface.addIndex(documentRetrievalResultTable, {
        name: `${documentRetrievalResultTable}_${createdAtIndex}`,
        fields: [
          {
            name: createdAtIndexFieldName,
            order: "DESC",
          },
        ],
        transaction,
      }),
    ]);
  });
};

export const down: Migration = ({ context: queryInterface }) => {
  return queryInterface.sequelize.transaction(async transaction => {
    await Promise.all([
      queryInterface.removeIndex(
        documentQueryResultTable,
        `${documentQueryResultTable}_${createdAtIndex}`,
        { transaction }
      ),
      queryInterface.removeIndex(
        documentRetrievalResultTable,
        `${documentRetrievalResultTable}_${createdAtIndex}`,
        { transaction }
      ),
    ]);
  });
};

import { DocumentQueryResultModel } from "../../../../models/medical/document-query-result";
import { DocumentQueryResult } from "../../domain/document-query-result";

export const getDocumentQueryResult = async ({
  requestId,
}: {
  requestId: string;
}): Promise<DocumentQueryResult[]> => {
  const docQueryResults = await DocumentQueryResultModel.findAll({
    where: {
      requestId,
    },
    order: [["created_at", "DESC"]],
  });

  if (!docQueryResults || docQueryResults.length === 0) {
    throw new Error(`No document query result found for requestId ${requestId}`);
  }

  return docQueryResults;
};

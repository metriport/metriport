import { ApiResponse } from "@opensearch-project/opensearch";

export type BulkOperation = "index" | "create" | "update" | "delete";
export type BulkRequest = Partial<Record<BulkOperation, { _id: string }>>;

type RawBulkResponseErrorBody = {
  errors: boolean;
  items: RawBulkResponseErrorItem[];
};
type RawBulkResponseErrorItem = Record<BulkOperation, RawBulkResponseErrorItemForOperation>;
type RawBulkResponseErrorItemForOperation = {
  error: { reason: string; type: string; index: string };
  status: number;
};

export type BulkResponseErrorItem = {
  index: string;
  operation: BulkOperation;
  status: number;
  type: string;
  reason: string;
};

export type OnBulkItemError = (error: BulkResponseErrorItem) => void;

/**
 * Gets the errors from a bulk response.
 *
 * @param response - The response from the bulk operation.
 * @param operation - The operation to get the errors for.
 * @param onItemError - The function to call for each item error, optional. Defaults to `bulkResponseErrorToString`.
 * @returns The errors from the bulk response.
 */
export function processErrorsFromBulkResponse(
  response: ApiResponse<Record<string, any>, unknown>, // eslint-disable-line @typescript-eslint/no-explicit-any
  operation: BulkOperation,
  onItemError?: OnBulkItemError
): number {
  const body = response.body as RawBulkResponseErrorBody;
  if (!body?.errors) return 0;
  let errorCount = 0;
  body.items?.forEach(item => {
    const itemOp = item[operation];
    if (itemOp && itemOp.status > 299) {
      errorCount++;
      onItemError?.({
        index: itemOp.error.index,
        operation,
        status: itemOp.status,
        type: itemOp.error.type,
        reason: itemOp.error.reason,
      });
    }
  });
  return errorCount;
}

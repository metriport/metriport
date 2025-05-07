import { ApiResponse } from "@opensearch-project/opensearch";
import { isTrue } from "@metriport/shared";
export type BulkOperation = "index" | "create" | "update" | "delete";

export function getErrorsFromBulkResponse(
  response: ApiResponse<Record<string, any>, unknown>, // eslint-disable-line @typescript-eslint/no-explicit-any
  operation: BulkOperation
): string[] {
  if (!isTrue(response.body.errors)) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return response.body.items.flatMap((item: any) => {
    if (item[operation].status > 299) {
      return bulkResponseErrorToString(item, operation) ?? [];
    }
    return [];
  });
}

export function bulkResponseErrorToString(
  singleItem: any, // eslint-disable-line @typescript-eslint/no-explicit-any
  operation: BulkOperation
): string | undefined {
  const errorAsAny = singleItem[operation].error;
  if (!errorAsAny) return undefined;
  return typeof errorAsAny === "string" ? errorAsAny : JSON.stringify(errorAsAny);
}

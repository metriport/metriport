import { Config } from "@metriport/core/util/config";
import {
  createQueryMetaSchema,
  defaultItemsPerPage,
  PaginatedResponse,
  ResponseMeta,
} from "@metriport/shared";
import { Request } from "express";
import {
  getPaginationItems,
  Pagination,
  PaginationFromItem,
  PaginationItem,
  PaginationToItem,
  PaginationWithCursor,
  CursorWhereClause,
} from "../command/pagination";
import { encodeCursor, CompositeCursor } from "@metriport/shared/domain/cursor-utils";
import { SortItem } from "@metriport/shared/domain/pagination";
import { MetriportError } from "@metriport/shared";
import { snakeCase } from "lodash";

export type ColumnValidationConfig = Record<string, string>;

const ALLOWED_SORT_ORDERS = ["asc", "desc"] as const;

function validateSortColumns(
  pagination: Pagination,
  allowedColumns: ColumnValidationConfig
): Pagination {
  // Validate each sort column
  pagination.sort.forEach(({ col, order }) => {
    if (!(col in allowedColumns)) {
      throw new MetriportError(
        `Invalid sort column: ${col}. Allowed columns: ${Object.keys(allowedColumns).join(", ")}`
      );
    }
    if (!ALLOWED_SORT_ORDERS.includes(order)) {
      throw new MetriportError(
        `Invalid sort order: ${order}. Allowed orders: ${ALLOWED_SORT_ORDERS.join(", ")}`
      );
    }
  });

  return pagination;
}

// Column name transformation is handled at SQL generation level for simplicity

/**
 * Builds composite cursor WHERE clause for complex multi-column pagination.
 *
 * For sort columns [col1 DESC, col2 ASC] and cursor {col1: val1, col2: val2}:
 *
 * Forward pagination (fromItem) generates:
 * (col1 < val1) OR (col1 = val1 AND col2 > val2)
 *
 * Backward pagination (toItem) generates:
 * (col1 > val1) OR (col1 = val1 AND col2 < val2)
 */
export function buildCompositeCursorWhereClause(
  cursor: CompositeCursor,
  sortItems: SortItem[],
  direction: "forward" | "backward",
  allowedColumns: ColumnValidationConfig
): CursorWhereClause {
  if (Object.keys(cursor).length === 0 || sortItems.length === 0) {
    return { clause: "", params: {} };
  }

  const conditions: string[] = [];
  const params: Record<string, unknown> = {};

  // Build lexicographic comparison conditions
  for (let i = 0; i < sortItems.length; i++) {
    const { col, order } = sortItems[i];
    const dbCol = snakeCase(col); // Transform to snake_case for SQL
    const table = allowedColumns[col]; // Use original camelCase for table lookup
    const cursorValue = cursor[col];

    if (cursorValue === undefined) {
      throw new MetriportError(`Cursor missing value for sort column: ${col}`);
    }

    // Build equality conditions for previous columns
    const equalityConditions = sortItems.slice(0, i).map((sortItem, idx) => {
      const prevTable = allowedColumns[sortItem.col];
      const prevDbCol = snakeCase(sortItem.col); // Transform to snake_case for SQL
      const prevCursorValue = cursor[sortItem.col];

      if (prevCursorValue === null || prevCursorValue === undefined) {
        return `${prevTable}.${prevDbCol} IS NULL`;
      } else {
        const paramKey = `cursor_${sortItem.col}_${idx}`;
        params[paramKey] = prevCursorValue;
        return `${prevTable}.${prevDbCol} = :${paramKey}`;
      }
    });

    // Determine comparison operator based on direction and sort order
    //
    // 💡 NOTE: We use >= operators because the cursor we're passing around is the _first value of the next page_!
    // This means we want to include the row for the cursor itself in the next page.
    let operator: string;
    if (direction === "forward") {
      // Forward: we want records "after" this cursor position
      operator = order === "asc" ? ">=" : "<=";
    } else {
      // Backward: we want records "before" this cursor position
      operator = order === "asc" ? "<=" : ">=";
    }

    // Build the condition for this level
    let comparisonCondition: string;
    if (cursorValue === null) {
      // Handle NULL cursor values based on NULL ordering behavior
      // In most SQL databases, NULL values come first in ASC order, last in DESC order
      if (direction === "forward") {
        // Forward: want records after NULL position
        comparisonCondition =
          order === "asc"
            ? `${table}.${dbCol} IS NOT NULL` // NULL comes first in ASC, so get non-null records
            : `FALSE`; // NULL comes last in DESC, so no records after
      } else {
        // Backward: want records before NULL position
        comparisonCondition =
          order === "asc"
            ? `FALSE` // NULL comes first in ASC, so no records before
            : `${table}.${dbCol} IS NOT NULL`; // NULL comes last in DESC, so get non-null records
      }
    } else {
      // Handle non-NULL cursor values
      const paramKey = `cursor_${col}_${i}`;
      params[paramKey] = cursorValue;

      // When cursor is not null, we may need to include NULL records depending on direction/order
      const baseComparison = `${table}.${dbCol} ${operator} :${paramKey}`;

      if (direction === "forward") {
        if (order === "asc") {
          // Forward ASC: want records > cursor, but NULLs come first so they shouldn't be included
          comparisonCondition = baseComparison;
        } else {
          // Forward DESC: want records < cursor, and may need to include NULLs if they come after cursor
          comparisonCondition = `(${baseComparison} OR ${table}.${dbCol} IS NULL)`;
        }
      } else {
        if (order === "asc") {
          // Backward ASC: want records < cursor, and may need to include NULLs if they come before cursor
          comparisonCondition = `(${baseComparison} OR ${table}.${dbCol} IS NULL)`;
        } else {
          // Backward DESC: want records > cursor, but NULLs come last so they shouldn't be included
          comparisonCondition = baseComparison;
        }
      }
    }

    // Combine equality conditions with comparison
    const condition =
      equalityConditions.length > 0
        ? `(${equalityConditions.join(" AND ")} AND ${comparisonCondition})`
        : comparisonCondition;

    conditions.push(condition);
  }

  const clause = conditions.length > 0 ? `AND (${conditions.join("\n\tOR ")})` : "";
  return { clause, params };
}

// TODO 483 remove this once pagination is fully rolled out
export function isPaginated(req: Request): boolean {
  const meta = createQueryMetaSchema().parse(req.query);
  return Object.keys(meta).length > 0;
}

export function getRequestMeta(req: Request, maxItemsPerPage: number): Pagination {
  const parsed = createQueryMetaSchema(maxItemsPerPage).parse(req.query);
  return {
    ...parsed,
    ...(parsed.count ? { count: Number(parsed.count) } : { count: defaultItemsPerPage }),
  };
}

/**
 * Function to paginate a list of items.
 *
 * @param request - The HTTP request object.
 * @param additionalQueryParams - Additional query parameters to be included in the pagination URL.
 * @param getItems - A function that takes pagination settings and returns a list of items for a given page.
 * @param getTotalCount - A function that returns the total number of items in all pages.
 * @param allowedSortColumns - The allowed sort columns for the items. Used to validate the sort columns in the request and prevent malicious queries.
 * @param hostUrl - The host URL to send the request to.
 * @param maxItemsPerPage - The maximum number of items per page.
 * @returns An object containing the pagination metadata and the current page's items.
 */
export async function paginated<T extends { id: string }>({
  request,
  additionalQueryParams,
  getItems,
  getTotalCount,
  allowedSortColumns,
  hostUrl = Config.getApiUrl(),
  maxItemsPerPage = 500,
}: {
  request: Request;
  additionalQueryParams: Record<string, string> | undefined;
  getItems: (pagination: PaginationWithCursor) => Promise<T[]>;
  getTotalCount: () => Promise<number>;
  allowedSortColumns: ColumnValidationConfig;
  hostUrl?: string;
  maxItemsPerPage?: number;
}): Promise<PaginatedResponse<T, "items">> {
  const requestMeta = getRequestMeta(request, maxItemsPerPage);
  const validatedMeta = validateSortColumns(requestMeta, allowedSortColumns);

  // Build composite cursor WHERE clauses (column name transformation happens inside)
  const fromItemClause = validatedMeta.fromItem
    ? buildCompositeCursorWhereClause(
        validatedMeta.fromItem,
        validatedMeta.sort,
        "forward",
        allowedSortColumns
      )
    : undefined;

  const toItemClause = validatedMeta.toItem
    ? buildCompositeCursorWhereClause(
        validatedMeta.toItem,
        validatedMeta.sort,
        "backward",
        allowedSortColumns
      )
    : undefined;

  const PaginationWithCursor: PaginationWithCursor = {
    ...validatedMeta,
    fromItemClause,
    toItemClause,
  };

  const { prevPageCursor, nextPageCursor, currPageItems, totalCount } = await getPaginationItems(
    PaginationWithCursor,
    getItems,
    getTotalCount
  );

  const responseMeta: ResponseMeta = {
    ...(prevPageCursor
      ? {
          prevPage: getPrevPageUrl(
            request,
            prevPageCursor,
            validatedMeta,
            additionalQueryParams,
            hostUrl
          ),
        }
      : {}),
    ...(nextPageCursor
      ? {
          nextPage: getNextPageUrl(
            request,
            nextPageCursor,
            validatedMeta,
            additionalQueryParams,
            hostUrl
          ),
        }
      : {}),
    itemsOnPage: currPageItems.length,
    itemsInTotal: totalCount,
  };
  return { meta: responseMeta, items: currPageItems };
}

function getPrevPageUrl(
  req: Request,
  prePageToItem: CompositeCursor,
  requestMeta: Pagination,
  additionalQueryParams: Record<string, string> | undefined,
  hostUrl: string
): string {
  const p: PaginationToItem = { toItem: prePageToItem };
  return getPaginationUrl(req, p, requestMeta, additionalQueryParams, hostUrl);
}

function getNextPageUrl(
  req: Request,
  nextPageFromItem: CompositeCursor,
  requestMeta: Pagination,
  additionalQueryParams: Record<string, string> | undefined,
  hostUrl: string
): string {
  const p: PaginationFromItem = { fromItem: nextPageFromItem };
  return getPaginationUrl(req, p, requestMeta, additionalQueryParams, hostUrl);
}

function getPaginationUrl(
  req: Request,
  item: PaginationItem,
  requestMeta: Pagination,
  additionalQueryParams: Record<string, string> | undefined,
  hostUrl: string
): string {
  const encodedItem = {
    ...(item.fromItem ? { fromItem: encodeCursor(item.fromItem) } : {}),
    ...(item.toItem ? { toItem: encodeCursor(item.toItem) } : {}),
  };

  const params = new URLSearchParams(encodedItem);
  params.append("count", requestMeta.count.toString());
  params.append("sort", requestMeta.originalSort.map(s => `${s.col}=${s.order}`).join(","));
  if (additionalQueryParams) {
    for (const [key, value] of Object.entries(additionalQueryParams)) {
      params.append(key, value);
    }
  }

  if ("_reconstructedRoute" in req) {
    return hostUrl + req._reconstructedRoute + "?" + params.toString();
  }
  return hostUrl + req.baseUrl + "?" + params.toString();
}

/**
 * One of "toItem" or "fromItem" are expected to be empty.
 * - fromItem indicates the minimum item to be included in the response, inclusive.
 * - toItem indicates the maximum item to be included in the response, inclusive.
 * - count indicates the number of items to be included in the response.
 */
export type Pagination =
  | {
      fromItem?: string;
      toItem?: never;
      count?: number;
    }
  | {
      fromItem?: never;
      toItem?: string;
      count?: number;
    };

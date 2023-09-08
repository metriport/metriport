import { Request } from "express";

export type RawParams = {
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string | string[] | undefined>;
};

/**
 * Returns the query params and headers from a request.
 *
 * @param req a Request object
 * @returns query params and headers
 */
export function getRawParams(req: Request): RawParams {
  return {
    query: { ...(req.query as RawParams["query"]) },
    headers: { ...(req.headers as RawParams["headers"]) },
  };
}

import { Request } from "express";
import { Context, GetWithoutParams, getFrom } from "../util";

export const tenoviApiKeyPropName = "x-tenovi-api-key";
export const tenoviClientNamePropName = "x-tenovi-client";

export function getTenoviApiKeyFrom(context: Context, req: Request): GetWithoutParams {
  return {
    optional: () => getTenoviHeaderFromOptional(context, tenoviApiKeyPropName, req),
    orFail: () => getTenoviHeaderFromOrFail(context, tenoviApiKeyPropName, req),
  };
}

export function getTenoviClientNameFrom(context: Context, req: Request): GetWithoutParams {
  return {
    optional: () => getTenoviHeaderFromOptional(context, tenoviClientNamePropName, req),
    orFail: () => getTenoviHeaderFromOrFail(context, tenoviClientNamePropName, req),
  };
}

function getTenoviHeaderFromOrFail(context: Context, propName: string, req: Request): string {
  return getFrom(context).orFail(propName, req);
}

function getTenoviHeaderFromOptional(
  context: Context,
  propName: string,
  req: Request
): string | undefined {
  const tenoviHeader = getFrom(context).optional(propName, req);
  return tenoviHeader ?? undefined;
}

import { Request } from "express";
import { z } from "zod";
import { Context, getFrom, GetWithoutParams } from "../util";

export const uuidSchema = z.string().uuid();

function validateUUID(id: string, propName?: string): string {
  return uuidSchema.parse(
    id,
    propName
      ? {
          path: [propName],
        }
      : undefined
  );
}
function getUUIDFromOrFail(context: Context, propName: string, req: Request): string {
  return validateUUID(getFrom(context).orFail(propName, req), propName);
}
function getUUIDFromOptional(context: Context, propName: string, req: Request): string | undefined {
  const id = getFrom(context).optional(propName, req);
  return id ? validateUUID(id, propName) : undefined;
}

export function getUUIDFrom(context: Context, req: Request, propName = "id"): GetWithoutParams {
  return {
    optional: () => getUUIDFromOptional(context, propName, req),
    orFail: () => getUUIDFromOrFail(context, propName, req),
  };
}

import { Request } from "express";
import { Context, GetWithoutParams } from "../util";
import { getUUIDFrom } from "./uuid";

export const userIdPropName = "userId";

export function getUserIdFrom(context: Context, req: Request): GetWithoutParams {
  return getUUIDFrom(context, req, userIdPropName);
}

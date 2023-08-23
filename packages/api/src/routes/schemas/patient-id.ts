import { Request } from "express";
import { Context, GetWithoutParams, getFrom } from "../util";

export const patientIdPropName = "patientId";

export function getPatientIdFrom(context: Context, req: Request): GetWithoutParams {
  return {
    optional: () => getPatientIdFromOptional(context, patientIdPropName, req),
    orFail: () => getPatientIdFromOrFail(context, patientIdPropName, req),
  };
}

function getPatientIdFromOrFail(context: Context, propName: string, req: Request): string {
  return getFrom(context).orFail(propName, req);
}

function getPatientIdFromOptional(
  context: Context,
  propName: string,
  req: Request
): string | undefined {
  return getFrom(context).optional(propName, req);
}

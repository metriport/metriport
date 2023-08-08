import { Request } from "express";
import { Context, GetWithoutParams, getFrom } from "../util";
import { z } from "zod";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(timezone);

export const timezoneIdSchema = z
  .string()
  .refine(timezoneId => isValidTimezone(timezoneId), { message: "" });

export const timezoneIdPropName = "timezoneId";

export function isValidTimezone(timezone: string): boolean {
  try {
    const sampleDate = "1945-05-09";
    dayjs.tz(sampleDate, timezone);
    return true;
  } catch (error) {
    return false;
  }
}

export function getTimezoneIdFrom(context: Context, req: Request): GetWithoutParams {
  return {
    optional: () => getTimezoneIdFromOptional(context, timezoneIdPropName, req),
    orFail: () => getTimezoneIdFromOrFail(context, timezoneIdPropName, req),
  };
}

function validateTimezoneId(id: string, propName?: string): string {
  return timezoneIdSchema.parse(
    id,
    propName
      ? {
          path: [propName],
        }
      : undefined
  );
}
function getTimezoneIdFromOrFail(context: Context, propName: string, req: Request): string {
  return validateTimezoneId(getFrom(context).orFail(propName, req), propName);
}
function getTimezoneIdFromOptional(
  context: Context,
  propName: string,
  req: Request
): string | undefined {
  const id = getFrom(context).optional(propName, req);
  return id ? validateTimezoneId(id, propName) : undefined;
}

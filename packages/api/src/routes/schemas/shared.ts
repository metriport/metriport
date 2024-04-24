import BadRequestError from "@metriport/core/util/error/bad-request";
import { z } from "zod";

export const stringListSchema = z.string().array();

export const stringListFromQuerySchema = z.union([z.string(), stringListSchema]).transform(v => {
  return Array.isArray(v) ? v : v.split(",").map(v => v.trim());
});

export const nonEmptyStringListFromQuerySchema = z
  .union([z.string(), stringListSchema])
  .transform(v => {
    return Array.isArray(v) ? v : v.split(",").map(v => v.trim());
  })
  .transform(arr => {
    arr.forEach((item: string) => {
      if (!item || item.trim().length === 0) {
        throw new BadRequestError("Invalid empty string");
      }
    });
    return arr;
  });

export const stringIntegerSchema = z
  .string()
  .regex(/^\d+$/, { message: "Invalid integer" })
  .transform(Number);

export function required<T>(dependent: keyof T) {
  return {
    when: (dependency: keyof T) => {
      return (val: T) => {
        if (val[dependency])
          return (
            val[dependent] !== undefined &&
            (typeof val[dependent] === "string" ? (val[dependent] as string).trim() !== "" : true)
          );
        return true;
      };
    },
  };
}

import { z } from "zod";

export const stringListSchema = z.string().array();

export const stringListFromQuerySchema = z.union([z.string(), stringListSchema]).transform(v => {
  return Array.isArray(v) ? v : v.split(",").map(v => v.trim());
});

export const stringIntegerSchema = z
  .string()
  .regex(/^\d+$/, { message: "Invalid integer" })
  .transform(Number);

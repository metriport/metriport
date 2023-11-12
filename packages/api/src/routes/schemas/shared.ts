import { z } from "zod";

export const stringListSchema = z.string().array();

export const stringIntegerSchema = z
  .string()
  .regex(/^\d+$/, { message: "Invalid integer" })
  .transform(Number);

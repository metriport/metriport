import { z } from "zod";

const valueSchema = z.string().max(500);
const keySchema = z.string().max(40);
const recordSchema = z.record(valueSchema);

export const cxRequestMetadataSchema = recordSchema
  .refine(
    data =>
      Object.keys(data).length <= 50 &&
      Object.keys(data).every(key => keySchema.safeParse(key).success),
    {
      message:
        "You can specify up to 50 keys, with key names up to 40 characters long and values up to 500 characters long.",
    }
  )
  .optional();

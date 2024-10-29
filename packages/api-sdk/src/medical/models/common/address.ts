import { z } from "zod";
import { addressSchema as addessSchemaShared } from "@metriport/shared";

export const addressSchema = addessSchemaShared;

export type Address = z.infer<typeof addressSchema>;

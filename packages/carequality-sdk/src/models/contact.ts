import { z } from "zod";
import { nameWithUse, objectValueOptional } from "./shared";
import { addressSchema } from "./address";

export const contactSchema = z.array(
  z.object({
    purpose: objectValueOptional,
    name: nameWithUse,
    telecom: z.array(
      z.object({
        system: objectValueOptional,
        value: objectValueOptional,
        use: objectValueOptional,
      })
    ),
    address: addressSchema,
  })
);

export type Contact = z.infer<typeof contactSchema>;

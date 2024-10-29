import { z } from "zod";
import { emailSchema } from "./email";
import { phoneSchema } from "./phone";

export const contactSchema = z
  .object({
    phone: phoneSchema,
    email: emailSchema.optional(),
  })
  .or(
    z.object({
      email: emailSchema,
    })
  );

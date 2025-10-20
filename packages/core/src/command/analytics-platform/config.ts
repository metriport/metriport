import { dbCredsSchema } from "@metriport/shared";
import { z } from "zod";

export const dbCredsForLambdaSchema = dbCredsSchema.omit({ password: true }).merge(
  z.object({
    passwordSecretArn: z.string(),
  })
);
export type DatabaseCredsForLambda = z.infer<typeof dbCredsForLambdaSchema>;

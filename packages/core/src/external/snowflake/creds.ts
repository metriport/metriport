import { z } from "zod";

// TODO leaving this here for the SnowflakeConnectorLambda
export const snowflakeCredsSchema = z.object({
  account: z.string(),
  user: z.string(),
  password: z.string(),
});
export type SnowflakeCreds = z.infer<typeof snowflakeCredsSchema>;

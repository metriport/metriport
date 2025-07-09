import { z } from "zod";

export const snowflakeCredsSchema = z.object({
  account: z.string(),
  user: z.string(),
  password: z.string(),
});
export type SnowflakeCreds = z.infer<typeof snowflakeCredsSchema>;

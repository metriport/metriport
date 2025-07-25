import { getEnvVarAsRecordOrFail } from "@metriport/shared";
import { z } from "zod";

const snowflakeCredsSchema = z.object({
  account: z.string(),
  user: z.string(),
  password: z.string(),
});
type SnowflakeCreds = z.infer<typeof snowflakeCredsSchema>;

export function getSnowflakeCreds(): SnowflakeCreds {
  return snowflakeCredsSchema.parse(getEnvVarAsRecordOrFail("SNOWFLAKE_CREDS"));
}

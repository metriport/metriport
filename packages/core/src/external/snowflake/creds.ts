import { MetriportError } from "@metriport/shared";
import { z } from "zod";
import { Config } from "../../util/config";

const snowflakeCredsSchema = z.object({
  account: z.string(),
  user: z.string(),
  password: z.string(),
});
type SnowflakeCreds = z.infer<typeof snowflakeCredsSchema>;

export function getSnowflakeCreds(): SnowflakeCreds {
  try {
    const snowflakeCreds = Config.getSnowflakeCreds();
    return snowflakeCredsSchema.parse(snowflakeCreds);
  } catch (error) {
    throw new MetriportError("Invalid snowflake creds", error);
  }
}

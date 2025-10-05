import { z } from "zod";

export const snowflakeRegionsSchema = z.enum(["us-east-1", "us-east-2", "us-west-2", "us-west-1"]);
export const snowflakeInstanceCredsSchema = z.object({
  account: z.string(),
  apiToken: z.string(),
  warehouseName: z.string(),
});
/**
 * Definition of the snowflake credentials all regions we support.
 *
 * Example of valid JSON for snowflakeCredsSchema:
 * {
 *   "us-east-1": {
 *     "account": "my-account",
 *     "apiToken": "my-api-token",
 *     "warehouseName": "my-warehouse"
 *   },
 *   "us-west-2": {
 *     "account": "another-account",
 *     "apiToken": "another-api-token",
 *     "warehouseName": "another-warehouse"
 *   }
 * }
 */
export const snowflakeCredsSchema = z.record(snowflakeRegionsSchema, snowflakeInstanceCredsSchema);
export type SnowflakeCreds = z.infer<typeof snowflakeCredsSchema>;

const constomSnowflakeSettingsForCxSchema = z.object({
  dbName: z.string(),
  dbSchema: z.string(),
});
/**
 * Definition of the custom snowflake settings for a given customer.
 * Optional, if not provided, the default snowflake settings will be used.
 *
 * Example of valid JSON for customSnowflakeSettingsSchema:
 * {
 *   "cxId": {
 *     "dbName": "my-db-name",
 *     "dbSchema": "my-db-schema"
 *   }
 * }
 */
export const customSnowflakeSettingsSchema = z.record(
  z.string(),
  constomSnowflakeSettingsForCxSchema
);
export type CustomSnowflakeSettings = z.infer<typeof customSnowflakeSettingsSchema>;

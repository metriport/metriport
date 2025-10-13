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

/**
 * Snowflake settings for a given customer.
 *
 * Example of valid JSON for snowflakeSettingsForCxSchema:
 * {
 *   "region": "us-east-1",
 *   "dbName": "cx-db-name",
 *   "dbSchema": "cx-db-schema"
 * }
 */
const snowflakeSettingsForCxSchema = z.object({
  region: snowflakeRegionsSchema,
  dbName: z.string(),
  dbSchema: z.string(),
});
export type SnowflakeSettingsForCx = z.infer<typeof snowflakeSettingsForCxSchema>;

/**
 * Snowflake settings for all customers.
 *
 * Example of valid JSON for snowflakeSettingsForAllCxsSchema:
 * {
 *   "cxId": {
 *     "region": "us-east-1",
 *     "dbName": "cx-db-name",
 *     "dbSchema": "cx-db-schema"
 *   },
 *   "cxId2": {
 *     "region": "us-west-2",
 *     "dbName": "cx-db-name",
 *     "dbSchema": "cx-db-schema"
 *   }
 * }
 */
export const snowflakeSettingsForAllCxsSchema = z.record(z.string(), snowflakeSettingsForCxSchema);
export type SnowflakeSettingsForAllCxs = z.infer<typeof snowflakeSettingsForAllCxsSchema>;

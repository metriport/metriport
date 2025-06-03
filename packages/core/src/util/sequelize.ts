import { PoolOptions, Sequelize } from "sequelize";
import { z } from "zod";

export const dbCredsSchema = z.object({
  dbname: z.string(),
  username: z.string(),
  password: z.string(),
  host: z.string(),
  port: z.number(),
  engine: z.literal("postgres"),
});
export type DbCreds = z.infer<typeof dbCredsSchema>;

export const dbReadReplicaEndpointSchema = z.object({
  host: z.string(),
  port: z.number(),
});
export type DbReadReplicaEndpoint = z.infer<typeof dbReadReplicaEndpointSchema>;

/**
 * This function is used to initialize the DB pool for raw queries that can't rely on Models.
 */
export function initDbPool(dbCreds: string, poolOptions?: PoolOptions, logging?: boolean) {
  const sqlDBCreds = JSON.parse(dbCreds);
  const parsedDbCreds = dbCredsSchema.parse(sqlDBCreds);
  return initDbPoolFromCreds(parsedDbCreds, poolOptions, logging);
}

/**
 * This function is used to initialize the DB pool for raw queries that can't rely on Models.
 */
function initDbPoolFromCreds(
  dbCreds: DbCreds,
  poolOptions: PoolOptions = {
    max: 5,
    min: 1,
    acquire: 30000,
    idle: 10000,
  },
  logging = false
) {
  const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
    host: dbCreds.host,
    port: dbCreds.port,
    dialect: dbCreds.engine,
    pool: poolOptions,
    logging,
  });
  return sequelize;
}

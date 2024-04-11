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
export type DbReadReplicaEndpoint = z.infer<typeof dbCredsSchema>;

/**
 * This function is used to initialize the readonly DB pool for queries that require the read replica.
 *
 * Note that this is a workaround while we don't have https://github.com/metriport/metriport-internal/issues/1174
 * in place.
 */
export function initReadonlyDBPool(
  dbCreds: string,
  dbReadReplicaEndpoint: string,
  poolOptions?: PoolOptions,
  logging?: boolean
) {
  const dbCredsRaw = JSON.parse(dbCreds);
  const parsedDbCreds = dbCredsSchema.parse(dbCredsRaw);

  const dbReadReplicaEndpointRaw = JSON.parse(dbReadReplicaEndpoint);
  const parsedDbReadReplicaEndpoint = dbReadReplicaEndpointSchema.parse(dbReadReplicaEndpointRaw);

  parsedDbCreds.host = parsedDbReadReplicaEndpoint.host;
  parsedDbCreds.port = parsedDbReadReplicaEndpoint.port;

  return initDBPoolFromCreds(parsedDbCreds, poolOptions, logging);
}

/**
 * This function is used to initialize the DB pool for raw queries that can't rely on Models.
 */
export function initDBPool(dbCreds: string, poolOptions?: PoolOptions, logging?: boolean) {
  const sqlDBCreds = JSON.parse(dbCreds);
  const parsedDbCreds = dbCredsSchema.parse(sqlDBCreds);
  return initDBPoolFromCreds(parsedDbCreds, poolOptions, logging);
}

/**
 * This function is used to initialize the DB pool for raw queries that can't rely on Models.
 */
function initDBPoolFromCreds(
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

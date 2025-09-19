import { PoolOptions, Sequelize } from "sequelize";
import { z } from "zod";

/**
 * @deprecated Use dbCredsSchema from @metriport/shared/domain/db.ts instead
 */
export const dbCredsSchema = z.object({
  dbname: z.string(),
  username: z.string(),
  password: z.string(),
  host: z.string(),
  port: z.number(),
  engine: z.literal("postgres"),
});
/**
 * @deprecated Use DbCreds from @metriport/shared/domain/db.ts instead
 */
export type DbCreds = z.infer<typeof dbCredsSchema>;

/**
 * TODO(ENG-1011): Stop using these pool options directly from lambda functions.
 * Instead, use the pool options and follow the guide specified in the sequelize docs.
 *
 * https://sequelize.org/docs/v6/other-topics/aws-lambda/
 */
export const defaultPoolOptions: PoolOptions = {
  max: 5,
  min: 1,
  acquire: 30_000,
  // Should be greater than CHECK_DB_INTERVAL to avoid connection thrash
  idle: 15_000,
  evict: 10_000,
};

export const dbReadReplicaEndpointSchema = z.object({
  host: z.string(),
  port: z.number(),
});
export type DbReadReplicaEndpoint = z.infer<typeof dbReadReplicaEndpointSchema>;

/**
 * This function is used to initialize the DB pool for raw queries that can't rely on Models.
 */
export function initDbPool(
  dbCreds: string,
  poolOptions?: PoolOptions,
  logging?: boolean
): Sequelize {
  const sqlDBCreds = JSON.parse(dbCreds);
  const parsedDbCreds = dbCredsSchema.parse(sqlDBCreds);
  return initDbPoolFromCreds(parsedDbCreds, poolOptions, logging);
}

/**
 * This function is used to initialize the DB pool for raw queries that can't rely on Models.
 *
 */
function initDbPoolFromCreds(
  dbCreds: DbCreds,
  poolOptions = defaultPoolOptions,
  logging = false
): Sequelize {
  const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
    host: dbCreds.host,
    port: dbCreds.port,
    dialect: dbCreds.engine,
    pool: poolOptions,
    logging,
  });
  return sequelize;
}

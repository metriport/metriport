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

/**
 * This function is used to initialize the DB pool for raw queries that can't rely on Models.
 */
export function initDBPool(
  dbCreds: string,
  poolOptions: PoolOptions = {
    max: 5,
    min: 1,
    acquire: 30000,
    idle: 10000,
  },
  logging = false
) {
  const sqlDBCreds = JSON.parse(dbCreds);
  const parsedDbCreds = dbCredsSchema.parse(sqlDBCreds);

  const sequelize = new Sequelize(
    parsedDbCreds.dbname,
    parsedDbCreds.username,
    parsedDbCreds.password,
    {
      host: parsedDbCreds.host,
      port: parsedDbCreds.port,
      dialect: parsedDbCreds.engine,
      pool: poolOptions,
      logging,
    }
  );
  return sequelize;
}

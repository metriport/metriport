import { Pool } from "pg";
import { DbCreds, dbCredsSchema, dbReadReplicaEndpointSchema } from "./sequelize";
// Initialize the main DB pool
export function initDbPool(dbCreds: DbCreds) {
  const parsedDbCreds = dbCredsSchema.parse(dbCreds);
  const pool = new Pool({
    user: parsedDbCreds.username,
    host: parsedDbCreds.host,
    database: parsedDbCreds.dbname,
    password: parsedDbCreds.password,
    port: parsedDbCreds.port,
  });

  return pool;
}

// Initialize the read-only DB pool
export function initReadonlyDbPool(dbCreds: string, dbReadReplicaEndpoint: string) {
  const parsedDbCreds = dbCredsSchema.parse(JSON.parse(dbCreds));
  const parsedDbReadReplicaEndpoint = dbReadReplicaEndpointSchema.parse(
    JSON.parse(dbReadReplicaEndpoint)
  );

  parsedDbCreds.host = parsedDbReadReplicaEndpoint.host;
  parsedDbCreds.port = parsedDbReadReplicaEndpoint.port;

  return initDbPool(parsedDbCreds);
}

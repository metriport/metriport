import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { Sequelize } from "sequelize";
import { getUmzugWithMeta } from "./index";
import MetriportError from "../errors/metriport-error";

/**
 * NOT TO BE USED WITHIN THE APPLICATION!
 *
 * This is just a CLI to be used manually from the dev's machine
 * in case something goes wrong during migrations.
 *
 * See the README for information about how to use it.
 */

let dbCreds;
try {
  const sqlDBCreds = process.env.DB_CREDS;
  if (!sqlDBCreds) throw new Error("Missing DB_CREDS env var");
  dbCreds = JSON.parse(sqlDBCreds);
} catch (err) {
  const msg = "Error processing DB_CREDS env var";
  console.log(msg, err);
  throw new MetriportError(msg, { cause: err });
}

const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
  host: dbCreds.host,
  port: dbCreds.port,
  dialect: dbCreds.engine,
  pool: {
    max: 50,
    min: 20,
    acquire: 30000,
    idle: 10000,
  },
});

async function main() {
  const { umzug, migrations, executed, pending, lastExecuted } = await getUmzugWithMeta(sequelize);
  console.log("");
  console.log(
    `[--- SEQUELIZE ---] Migrations: ${executed} executed, ${pending} pending, ` +
      `${migrations} total, last executed: ${lastExecuted}`
  );
  console.log("");
  await umzug.runAsCLI();
  process.exit();
}

main();

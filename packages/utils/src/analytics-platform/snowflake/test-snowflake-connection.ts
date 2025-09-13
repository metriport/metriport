// 3-ingest-from-merged-csvs.ts
import dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import {
  promisifyConnect,
  promisifyDestroy,
  promisifyExecute,
} from "@metriport/core/external/snowflake/commands";
import { errorToString, getEnvVarOrFail, sleep } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { abbreviateNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { groupBy } from "lodash";
import * as snowflake from "snowflake-sdk";
import { elapsedTimeAsStr } from "../../shared/duration";

dayjs.extend(duration);

/**
 * Script to test the connection to Snowflake.
 *
 * Usage:
 * - set env vars on .env file
 *
 * Run it with:
 * - ts-node src/analytics-platform/snowflake/test-snowflake-connection.ts
 */

const account = getEnvVarOrFail("SNOWFLAKE_ACCOUNT");
const token = getEnvVarOrFail("SNOWFLAKE_TOKEN");
const database = getEnvVarOrFail("SNOWFLAKE_DB");
const schema = getEnvVarOrFail("SNOWFLAKE_SCHEMA");
const warehouse = getEnvVarOrFail("SNOWFLAKE_WH");

snowflake.configure({
  ocspFailOpen: false,
  logLevel: "WARN",
  additionalLogToConsole: false,
});

async function main() {
  await sleep(50); // Give some time to avoid mixing logs w/ Node's
  const startedAt = Date.now();
  console.log(`############## Started at ${buildDayjs().toISOString()} ##############`);

  await testIt();

  console.log(`>>>>>>> Done after ${elapsedTimeAsStr(startedAt)}`);
}

async function testIt() {
  const connection = snowflake.createConnection({
    account,
    token,
    database,
    schema,
    warehouse,
    authenticator: "PROGRAMMATIC_ACCESS_TOKEN",
    clientSessionKeepAlive: true,
  });
  try {
    console.log(">>> Connecting to Snowflake...");
    const connectAsync = promisifyConnect(connection);
    await connectAsync();
    console.log("Connected to Snowflake.");

    const executeAsync = promisifyExecute(connection);
    // await executeAsync(`USE DATABASE ${database}`);
    // await executeAsync(`USE SCHEMA ${schema}`);

    console.log("Listing tables I have access to...");
    const dropStageCmd = `SHOW TABLES;`;
    const { rows: rowsRaw } = await executeAsync(dropStageCmd);

    const rows: {
      name: string;
      database_name: string;
      rows: number;
      bytes: number;
      owner: string;
      kind: string;
    }[] = rowsRaw ?? [];
    const groupByDatabase = groupBy(rows, "database_name");
    for (const databaseName of Object.keys(groupByDatabase)) {
      console.log(`Database: ${databaseName}`);
      const tables = groupByDatabase[databaseName];
      tables.forEach(table => {
        console.log(
          `> ${table.name} (${table.kind}): ` +
            `${abbreviateNumber(table.rows)} rows, ` +
            `${abbreviateNumber(table.bytes)} bytes, ` +
            `owner: ${table.owner}`
        );
      });
    }
  } finally {
    try {
      const destroyAsync = promisifyDestroy(connection);
      await destroyAsync();
    } catch (error) {
      console.error("Error destroying connection: ", errorToString(error));
    }
  }
}

main();

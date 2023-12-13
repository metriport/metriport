import * as dotenv from "dotenv";
dotenv.config();
// Keep dotenv import and config before everything else
import { getEnvVarOrFail } from "@metriport/core/util/env-var";
import { ISO_DATE } from "@metriport/shared/common/date";
import AWS from "aws-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { QueryTypes, Sequelize } from "sequelize";

dayjs.extend(duration);

/**
 * Exports contents of a SQL query to S3, as JSON.
 *
 * Populate the env vars.
 *
 * Update `tableName` and `daysToKeep` to match your needs.
 */

const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const bucketName = getEnvVarOrFail("S3_BUCKET_NAME");
const region = getEnvVarOrFail("AWS_REGION");

// Example:
// const daysToKeep = 30;
// const tableName = "change_log";
const daysToKeep = 999;
const tableName = "<TABLE>";

const query = `SELECT * FROM ${tableName} WHERE created_at < current_date - interval '${daysToKeep}' day`;

const untilDate = dayjs().subtract(daysToKeep, "day").format(ISO_DATE);
const getFileName = () =>
  `exports/${region}/${tableName}_until_${untilDate}_createdAt_${dayjs().toISOString()}.json`;

const s3 = new AWS.S3({ signatureVersion: "v4", region });

// Returns string representation of memory usage in MB
function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: `${Math.round((usage.rss / 1024 / 1024) * 100) / 100} MB`,
    heapTotal: `${Math.round((usage.heapTotal / 1024 / 1024) * 100) / 100} MB`,
    heapUsed: `${Math.round((usage.heapUsed / 1024 / 1024) * 100) / 100} MB`,
    external: `${Math.round((usage.external / 1024 / 1024) * 100) / 100} MB`,
  };
}
function logMemoryUsage() {
  console.log(`...Memory usage: ${JSON.stringify(getMemoryUsage(), null, 2)}`);
}

async function main() {
  console.log(`Running coverage enhancement... - started at ${new Date().toISOString()}`);
  const startedAt = Date.now();
  logMemoryUsage();

  const dbCreds = JSON.parse(sqlDBCreds);

  const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
    host: dbCreds.host,
    port: dbCreds.port,
    dialect: dbCreds.engine,
  });

  const results = await sequelize.query(query, { type: QueryTypes.SELECT });
  console.log(`Found ${results.length} records`);
  logMemoryUsage();

  const fileName = getFileName();
  console.log(`Writing to S3 bucket: ${bucketName}/${fileName}`);
  const uploaded = await s3
    .upload({
      Bucket: bucketName,
      Key: fileName,
      Body: JSON.stringify(results),
      ContentType: "application/json",
    })
    .promise();

  console.log(`Uploaded to location: ${uploaded.Location}`);
  logMemoryUsage();

  const duration = Date.now() - startedAt;
  const durationMin = dayjs.duration(duration).asMinutes();
  console.log(`Done - total time: ${duration} ms / ${durationMin} min`);

  // for some reason it was hanging when updating this script, this fixes it
  process.exit(0);
}

main();

import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { CustomSnowflakeSettings, SnowflakeCreds } from "../../../../external/snowflake/creds";
import { out } from "../../../../util/log";

dayjs.extend(duration);

/**
 * TODO eng-1179 implement this off of 3-ingest-from-merged-csvs.ts
 */
export async function ingestCoreIntoSnowflake({
  cxId,
  region,
  bucketName,
  snowflakeCreds,
  snowflakeCustomCxSettings,
}: {
  cxId: string;
  region: string;
  bucketName: string;
  snowflakeCreds: SnowflakeCreds;
  snowflakeCustomCxSettings?: CustomSnowflakeSettings | undefined;
}): Promise<void> {
  const { log } = out(`ingestCoreIntoSnowflake - cx ${cxId}`);

  log(`>>> Running it with cxId: ${cxId}`);
  const startedAt = Date.now();

  log(
    `Would be ingesting core data into Snowflake... using snowflakeCreds: ${region}, ${bucketName}, ${!!snowflakeCreds}, ${!!snowflakeCustomCxSettings}`
  );

  log(`>>>>>>> Done after ${Date.now() - startedAt}ms`);
}

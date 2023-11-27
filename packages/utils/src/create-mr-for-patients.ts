import * as dotenv from "dotenv";
dotenv.config();
// keep that ^ on top
import fs from "fs";
import https from "https";
import { MetriportMedicalApi } from "@metriport/api-sdk";
import { getEnvVar, getEnvVarOrFail } from "@metriport/core/util/env-var";
import { Sequelize } from "sequelize";
import { sleep } from "@metriport/core/util/sleep";

const apiUrl = getEnvVarOrFail("API_URL");
const apiKey = getEnvVarOrFail("API_KEY");
const cxId = getEnvVarOrFail("CX_ID");
const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
const orgName = getEnvVar("ORG_NAME");

const DIR_NAME = `${orgName}_MR_Summaries`;

const patientIds: string[] = [];

const metriportAPI = new MetriportMedicalApi(apiKey, {
  baseAddress: apiUrl,
});

const dbCreds = JSON.parse(sqlDBCreds);
const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
  host: dbCreds.host,
  port: dbCreds.port,
  dialect: dbCreds.engine,
});

const sqlQuery = `SELECT * FROM webhook_request WHERE cx_id = '${cxId}' AND type = 'medical.consolidated-data' ORDER BY created_at DESC LIMIT 10;`;

async function main() {
  let latestWebhookId = "";
  fs.mkdirSync(`./${DIR_NAME}`, { recursive: true });

  for (const patientId of patientIds) {
    try {
      await metriportAPI.startConsolidatedQuery(patientId, [], undefined, undefined, "pdf", {
        disableWHFlag: "true",
      });

      await sleep(10000);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { url, webhookId } = await recursiveWebhook(latestWebhookId);

      latestWebhookId = webhookId;

      if (!url) {
        continue;
      }

      await downloadFile(url, patientId);

      console.log("Completed", patientId);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      console.log(error);
    }
  }
}

async function recursiveWebhook(
  latestWebhookId: string
): Promise<{ url: string | null; webhookId: string }> {
  //eslint-disable-next-line @typescript-eslint/no-explicit-any
  const webhooks: any = await sequelize.query(sqlQuery);

  const webhookId = webhooks[0][0].id;

  if (latestWebhookId === webhookId) {
    await sleep(10000);
    return recursiveWebhook(latestWebhookId);
  }

  const bundle = webhooks[0][0]?.payload.patients[0].bundle;

  if (bundle.total > 0) {
    const url = bundle.entry[0].resource.content[0].attachment.url;

    return {
      url,
      webhookId,
    };
  } else {
    return {
      url: null,
      webhookId,
    };
  }
}

async function downloadFile(url: string, patientId: string) {
  return new Promise(resolve => {
    https.get(url, res => {
      const fileStream = fs.createWriteStream(`./${DIR_NAME}/${patientId}.pdf`);
      res.pipe(fileStream);

      fileStream.on("finish", () => {
        fileStream.close();
        console.log("Download finished");
        resolve("success");
      });
    });
  });
}
main();

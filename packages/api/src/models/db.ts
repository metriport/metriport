import * as AWS from "aws-sdk";
import { Sequelize } from "sequelize";
import { CQDirectoryEntryModel } from "../external/carequality/models/cq-directory";
import { CQDirectoryEntryViewModel } from "../external/carequality/models/cq-directory-view";
import { CQPatientDataModel } from "../external/carequality/models/cq-patient-data";
import { OutboundDocumentQueryRespModel } from "../external/carequality/models/outbound-document-query-resp";
import { OutboundDocumentRetrievalRespModel } from "../external/carequality/models/outbound-document-retrieval-resp";
import { OutboundPatientDiscoveryRespModel } from "../external/carequality/models/outbound-patient-discovery-resp";
import { CwPatientDataModel } from "../external/commonwell/models/cw-patient-data";
import { HIEDirectoryEntryViewModel } from "../external/hie/models/hie-directory-view";
import { FacilityModel } from "../models/medical/facility";
import { OrganizationModel } from "../models/medical/organization";
import updateDB from "../sequelize";
import { Config } from "../shared/config";
import { ModelSetup } from "./_default";
import { ConnectedUser } from "./connected-user";
import { CxMappingModel } from "./cx-mapping";
import { initDDBDev, initLocalCxAccount } from "./db-dev";
import { FacilityMappingModel } from "./facility-mapping";
import { FeedbackModel } from "./feedback";
import { FeedbackEntryModel } from "./feedback-entry";
import { InvalidLinksModel } from "./invalid-links";
import { JwtTokenModel } from "./jwt-token";
import { CoverageEnhancementModel } from "./medical/coverage-enhancement";
import { DocRefMappingModel } from "./medical/docref-mapping";
import { MAPIAccess } from "./medical/mapi-access";
import { PatientModel } from "./medical/patient";
import { PatientMappingModel } from "./patient-mapping";
import { PatientSettingsModel } from "./patient-settings";
import { Settings } from "./settings";
import { WebhookRequest } from "./webhook-request";

// models to setup with sequelize
const models: ModelSetup[] = [
  ConnectedUser.setup,
  Settings.setup,
  WebhookRequest.setup,
  OrganizationModel.setup,
  CQDirectoryEntryModel.setup,
  CQDirectoryEntryViewModel.setup,
  CQPatientDataModel.setup,
  CwPatientDataModel.setup,
  FacilityModel.setup,
  PatientModel.setup,
  HIEDirectoryEntryViewModel.setup,
  MAPIAccess.setup,
  DocRefMappingModel.setup,
  OutboundPatientDiscoveryRespModel.setup,
  OutboundDocumentQueryRespModel.setup,
  OutboundDocumentRetrievalRespModel.setup,
  CoverageEnhancementModel.setup,
  FeedbackModel.setup,
  FeedbackEntryModel.setup,
  CxMappingModel.setup,
  PatientMappingModel.setup,
  PatientSettingsModel.setup,
  FacilityMappingModel.setup,
  JwtTokenModel.setup,
  InvalidLinksModel.setup,
];

export type DbPoolProps = {
  max: number;
  min: number;
  acquire: number;
  idle: number;
};

export type MetriportDB = {
  sequelize: Sequelize;
  doc: AWS.DynamoDB.DocumentClient;
};

let db: MetriportDB | undefined;
export const getDB = (): MetriportDB => {
  if (!db) throw new Error("DB not initialized");
  return db;
};

export interface DocTableNames {
  token: string;
  rateLimit?: string;
}
export let docTableNames: DocTableNames;

async function initDB(): Promise<void> {
  // make sure we have the env vars we need
  const sqlDBCreds = Config.getDBCreds();
  const tokenTableName = Config.getTokenTableName();
  const rateLimitTableName = Config.getRateLimitTableName();
  const logDBOperations = Config.isCloudEnv() ? false : true;
  const dbPoolSettings = getDbPoolSettings();

  docTableNames = {
    token: tokenTableName,
    rateLimit: rateLimitTableName,
  };

  // get database creds
  const dbCreds = JSON.parse(sqlDBCreds);
  console.log("[server]: connecting to db...");
  const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
    host: dbCreds.host,
    port: dbCreds.port,
    dialect: dbCreds.engine,
    pool: dbPoolSettings,
    logging: logDBOperations,
    logQueryParameters: logDBOperations,
  });
  try {
    await sequelize.authenticate();

    // run DB migrations - update the DB to the expected state
    await updateDB(sequelize);

    // define all models
    for (const setup of models) setup(sequelize);

    let doc: AWS.DynamoDB.DocumentClient;
    // init dynamo db doc client
    if (Config.isCloudEnv()) {
      doc = new AWS.DynamoDB.DocumentClient({
        apiVersion: "2012-08-10",
      });
    } else {
      doc = await initDDBDev();
      await initLocalCxAccount();
    }
    // set db object for external references
    db = { sequelize, doc };
    console.log("[server]: connecting to db success!");
  } catch (err) {
    console.log("[server]: connecting to db failed :(");
    console.log(err);
    throw err;
  }
}

function getDbPoolSettings(): DbPoolProps {
  function getAndParseSettings(): Partial<Record<keyof DbPoolProps, string>> {
    try {
      const rawProps = Config.getDbPoolSettings();
      const parsedProps = rawProps ? JSON.parse(rawProps) : {};
      return parsedProps;
    } catch (error) {
      console.log("Error parsing db pool settings", error);
      return {};
    }
  }
  const parsedProps = getAndParseSettings();
  // https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.setting-capacity.html#aurora-serverless-v2.max-connections
  const max = getOptionalInteger(parsedProps.max) ?? 500;
  const min = getOptionalInteger(parsedProps.min) ?? 50;
  const acquire = getOptionalInteger(parsedProps.acquire) ?? 10_000;
  const idle = getOptionalInteger(parsedProps.idle) ?? 10_000;
  return {
    max,
    min,
    acquire,
    idle,
  };
}

function getOptionalInteger(prop: string | undefined): number | undefined {
  if (!prop) return undefined;
  const resp = parseInt(prop);
  if (isNaN(resp)) return undefined;
  return resp;
}

export default initDB;

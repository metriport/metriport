import { Config as ConfigCore } from "@metriport/core/util/config";
import {
  DbCreds,
  DbCredsReadOnly,
  dbCredsSchema,
  dbCredsSchemaReadOnly,
  DbPoolSettings,
  dbPoolSettingsSchema,
} from "@metriport/shared";
import * as AWS from "aws-sdk";
import { Sequelize } from "sequelize";
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
import { PatientModelReadOnly } from "./medical/patient-readonly";
import { PatientMappingModel } from "./patient-mapping";
import { PatientSettingsModel } from "./patient-settings";
import { Settings } from "./settings";
import { WebhookRequest } from "./webhook-request";
import { ModelSetup } from "./_default";

// models to setup with sequelize
const models: ModelSetup[] = [
  ConnectedUser.setup,
  Settings.setup,
  WebhookRequest.setup,
  OrganizationModel.setup,
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

const modelsReadOnly: ModelSetup[] = [PatientModelReadOnly.setup];

export type MetriportDB = {
  sequelize: Sequelize;
  sequelizeReadOnly: Sequelize;
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
  featureFlags: string;
}
export let docTableNames: DocTableNames;

async function initDB(): Promise<void> {
  // make sure we have the env vars we need
  const tokenTableName = Config.getTokenTableName();
  const rateLimitTableName = Config.getRateLimitTableName();
  const featureFlagsTableName = ConfigCore.getFeatureFlagsTableName();
  const logDBOperations = Config.isCloudEnv() ? false : true;
  const dbPoolSettings = getDbPoolSettings();

  docTableNames = {
    token: tokenTableName,
    rateLimit: rateLimitTableName,
    featureFlags: featureFlagsTableName,
  };

  // get database creds
  const dbCreds = getDbCreds();
  console.log("[server]: connecting to db...");
  const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
    host: dbCreds.host,
    port: dbCreds.port,
    dialect: dbCreds.engine,
    pool: dbPoolSettings,
    logging: logDBOperations,
    logQueryParameters: logDBOperations,
  });
  const readerEndpoint = getDbReadReplicaEndpoint();
  console.log("[server]: connecting to db read replica...");
  const sequelizeReadOnly = Config.isCloudEnv()
    ? new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
        host: readerEndpoint.host,
        port: readerEndpoint.port,
        dialect: dbCreds.engine,
        pool: dbPoolSettings,
        logging: logDBOperations,
        logQueryParameters: logDBOperations,
      })
    : sequelize;
  try {
    await Promise.all([sequelize.authenticate(), sequelizeReadOnly.authenticate()]);

    // run DB migrations - update the DB to the expected state
    await updateDB(sequelize);

    // define all models
    for (const setup of models) setup(sequelize);
    for (const setup of modelsReadOnly) setup(sequelizeReadOnly);

    // Set up model associations
    PatientModelReadOnly.associate({ PatientSettingsModel });
    PatientSettingsModel.associate({ PatientModelReadOnly });

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
    db = { sequelize, sequelizeReadOnly, doc };
    console.log("[server]: connecting to db success!");
  } catch (err) {
    console.log("[server]: connecting to db failed :(");
    console.log(err);
    throw err;
  }
}

function getDbPoolSettings(): DbPoolSettings {
  function getAndParseSettings(): Partial<Record<keyof DbPoolSettings, string>> {
    try {
      const rawProps = Config.getDbPoolSettings();
      const parsedProps = rawProps ? dbPoolSettingsSchema.parse(JSON.parse(rawProps)) : {};
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

function getDbCreds(): DbCreds {
  function getAndParseDbCreds(): DbCreds {
    try {
      const rawProps = Config.getDBCreds();
      const parsedProps = dbCredsSchema.parse(JSON.parse(rawProps));
      return parsedProps;
    } catch (error) {
      console.log("Error parsing db creds", error);
      throw error;
    }
  }
  const parsedProps = getAndParseDbCreds();
  return parsedProps;
}

function getDbReadReplicaEndpoint(): DbCredsReadOnly {
  function getAndParseReaderEndpoint(): DbCredsReadOnly {
    try {
      const rawProps = Config.getDbReadReplicaEndpoint();
      const parsedProps = dbCredsSchemaReadOnly.parse(JSON.parse(rawProps));
      return parsedProps;
    } catch (error) {
      console.log("Error parsing db read replica endpoint", error);
      throw error;
    }
  }
  const parsedProps = getAndParseReaderEndpoint();
  return parsedProps;
}

export default initDB;

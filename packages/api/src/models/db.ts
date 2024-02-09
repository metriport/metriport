import * as AWS from "aws-sdk";
import { Sequelize } from "sequelize";
import { CQDirectoryEntryModel } from "../external/carequality/models/cq-directory";
import { CQPatientDataModel } from "../external/carequality/models/cq-patient-data";
import { PatientDiscoveryResultModel } from "../external/carequality/models/patient-discovery-result";
import { FacilityModel } from "../models/medical/facility";
import { OrganizationModel } from "../models/medical/organization";
import updateDB from "../sequelize";
import { Config } from "../shared/config";
import { ConnectedUser } from "./connected-user";
import { initDDBDev, initLocalCxAccount } from "./db-dev";
import { CoverageEnhancementModel } from "./medical/coverage-enhancement";
import { DocRefMappingModel } from "./medical/docref-mapping";
import { IHEToExternalGwDocumentQueryModel } from "../external/carequality/models/ihe-to-external-gw-document-query";
import { IHEToExternalGwDocumentRetrievalModel } from "../external/carequality/models/ihe-to-external-gw-document-retrieval";
import { MAPIAccess } from "./medical/mapi-access";
import { PatientModel } from "./medical/patient";
import { Settings } from "./settings";
import { WebhookRequest } from "./webhook-request";
import { ModelSetup } from "./_default";

// models to setup with sequelize
const models: ModelSetup[] = [
  ConnectedUser.setup,
  Settings.setup,
  WebhookRequest.setup,
  OrganizationModel.setup,
  CQDirectoryEntryModel.setup,
  CQPatientDataModel.setup,
  FacilityModel.setup,
  PatientModel.setup,
  MAPIAccess.setup,
  DocRefMappingModel.setup,
  PatientDiscoveryResultModel.setup,
  IHEToExternalGwDocumentQueryModel.setup,
  IHEToExternalGwDocumentRetrievalModel.setup,
  CoverageEnhancementModel.setup,
];

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
}
export let docTableNames: DocTableNames;

const initDB = async (): Promise<void> => {
  // make sure we have the env vars we need
  const sqlDBCreds = Config.getDBCreds();
  const tokenTableName = Config.getTokenTableName();
  const logDBOperations = Config.isProdEnv() || Config.isSandbox() ? false : true;

  docTableNames = {
    token: tokenTableName,
  };

  // get database creds
  const dbCreds = JSON.parse(sqlDBCreds);
  console.log("[server]: connecting to db...");
  const sequelize = new Sequelize(dbCreds.dbname, dbCreds.username, dbCreds.password, {
    host: dbCreds.host,
    port: dbCreds.port,
    dialect: dbCreds.engine,
    pool: {
      max: 300,
      min: 20,
      acquire: 30000,
      idle: 10000,
    },
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
};

export default initDB;

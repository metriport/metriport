import * as AWS from "aws-sdk";
import { Sequelize } from "sequelize";
import updateDB from "../sequelize";
import { Config, getEnvVarOrFail } from "../shared/config";
import { ConnectedUser } from "./connected-user";
import { Settings } from "./settings";
import { initDDBDev } from "./db-dev";
import { ModelSetup } from "./_default";

// models to setup with sequelize
const models: ModelSetup[] = [ConnectedUser.setup, Settings.setup];

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
  const sqlDBCreds = getEnvVarOrFail("DB_CREDS");
  const tokenTableName = getEnvVarOrFail("TOKEN_TABLE_NAME");

  docTableNames = {
    token: tokenTableName,
  };

  // get database creds
  var dbCreds = JSON.parse(sqlDBCreds);
  console.log("[server]: connecting to db...");
  const sequelize = new Sequelize(
    dbCreds.dbname,
    dbCreds.username,
    dbCreds.password,
    {
      host: dbCreds.host,
      port: dbCreds.port,
      dialect: dbCreds.engine,
      pool: {
        max: 50,
        min: 20,
        acquire: 30000,
        idle: 10000,
      },
    }
  );
  try {
    await sequelize.authenticate();

    // run DB migrations - update the DB to the expected state
    await updateDB(sequelize);
    // await sequelize.sync({force: true});

    // define all models
    for (const setup of models) setup(sequelize);

    let doc: AWS.DynamoDB.DocumentClient;
    // init dynamo db doc client
    if (Config.isProdEnv()) {
      doc = new AWS.DynamoDB.DocumentClient({
        apiVersion: "2012-08-10",
      });
    } else {
      doc = await initDDBDev();
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

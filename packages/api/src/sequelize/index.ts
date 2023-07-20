import { QueryInterface, Sequelize } from "sequelize";
import { MigrationMeta, MigrationParams, SequelizeStorage, Umzug } from "umzug";
import { Config } from "../shared/config";

let umzug: Umzug<QueryInterface> | undefined = undefined;

const migrations = Config.isCloudEnv()
  ? "api/app/dist/sequelize/migrations/*.js"
  : "src/sequelize/migrations/*.ts";

export const getUmzug = (sequelize: Sequelize): Umzug<QueryInterface> => {
  if (!umzug) {
    umzug = new Umzug({
      migrations: { glob: migrations },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: console,
    });
  }
  return umzug;
};

// export the type helper exposed by umzug, which will have the `context` argument typed correctly
export type Migration = (params: MigrationParams<QueryInterface>) => Promise<unknown>;

const updateDB = async (sequelize: Sequelize): Promise<MigrationMeta[]> => {
  const queryInterface = sequelize.getQueryInterface();
  const migrations = await getUmzug(sequelize).migrations(queryInterface);
  const executed = await getUmzug(sequelize).executed();
  const pending = await getUmzug(sequelize).pending();
  console.log(
    `[--- SEQUELIZE ---] Migrations: ${executed.length} executed, ${pending.length} pending, ${migrations.length} total`
  );
  return getUmzug(sequelize).up();
};

export default updateDB;

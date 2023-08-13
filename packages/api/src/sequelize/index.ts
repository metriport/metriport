import { QueryInterface, Sequelize } from "sequelize";
import { MigrationMeta, MigrationParams, SequelizeStorage, Umzug } from "umzug";
import { Config } from "../shared/config";

let umzug: Umzug<QueryInterface> | undefined = undefined;

const migrationsPath = Config.isCloudEnv()
  ? "packages/api/dist/sequelize/migrations/*.js"
  : "src/sequelize/migrations/*.ts";

export const getUmzug = (sequelize: Sequelize): Umzug<QueryInterface> => {
  if (!umzug) {
    umzug = new Umzug({
      migrations: { glob: migrationsPath },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: console,
    });
  }
  return umzug;
};

export const getUmzugWithMeta = async (
  sequelize: Sequelize
): Promise<{
  umzug: Umzug<QueryInterface>;
  migrations: number;
  executed: number;
  pending: number;
}> => {
  const queryInterface = sequelize.getQueryInterface();
  const umzug = getUmzug(sequelize);
  const migrations = await umzug.migrations(queryInterface);
  const executed = await umzug.executed();
  const pending = await umzug.pending();
  return {
    umzug,
    migrations: migrations.length,
    executed: executed.length,
    pending: pending.length,
  };
};

// export the type helper exposed by umzug, which will have the `context` argument typed correctly
export type Migration = (params: MigrationParams<QueryInterface>) => Promise<unknown>;

const updateDB = async (sequelize: Sequelize): Promise<MigrationMeta[]> => {
  const { umzug, migrations, executed, pending } = await getUmzugWithMeta(sequelize);
  console.log(
    `[--- SEQUELIZE ---] Migrations: ${executed} executed, ${pending} pending, ${migrations} total`
  );
  return umzug.up();
};

export default updateDB;

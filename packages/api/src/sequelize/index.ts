import { MetriportError } from "@metriport/core/util/error/metriport-error";
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
  lastExecuted: string | undefined;
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
    lastExecuted: executed[executed.length - 1]?.name,
  };
};

// export the type helper exposed by umzug, which will have the `context` argument typed correctly
export type Migration = (params: MigrationParams<QueryInterface>) => Promise<unknown>;

const updateDB = async (sequelize: Sequelize): Promise<MigrationMeta[]> => {
  const prefix = `[--- SEQUELIZE ---] `;
  const { umzug, migrations, executed, pending, lastExecuted } = await getUmzugWithMeta(sequelize);
  console.log(
    `${prefix}Migrations: ${executed} executed, ${pending} pending, ` +
      `${migrations} total, last executed: ${lastExecuted}`
  );
  try {
    // Execute all migrations that are not yet executed
    return await umzug.up();
  } catch (error) {
    const mainMsg = `${prefix}Error running migrations`;
    if (lastExecuted) {
      console.error(`${mainMsg}, rolling back to last executed migration: ${lastExecuted}`);
      try {
        await umzug.down({ to: lastExecuted });
      } catch (error2) {
        const msg = `${prefix}ERROR rolling back to last executed migration`;
        console.error(`${msg}: ${lastExecuted}`, error2);
        throw new MetriportError(msg, error2, {
          originalError: String(error),
          additionalContext: msg,
        });
      }
    } else {
      console.error(`${mainMsg}, nothing to rolling back to`);
    }
    throw error;
  }
};

export default updateDB;

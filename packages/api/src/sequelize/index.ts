import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { QueryInterface, Sequelize } from "sequelize";
import { MigrationError, MigrationMeta, MigrationParams, SequelizeStorage, Umzug } from "umzug";
import { Config } from "../shared/config";

let umzug: Umzug<QueryInterface> | undefined = undefined;

const migrationsPath = Config.isCloudEnv()
  ? "packages/api/dist/sequelize/migrations/*.js"
  : "src/sequelize/migrations/*.ts";

export function getUmzug(sequelize: Sequelize): Umzug<QueryInterface> {
  if (!umzug) {
    umzug = new Umzug({
      migrations: { glob: migrationsPath },
      context: sequelize.getQueryInterface(),
      storage: new SequelizeStorage({ sequelize }),
      logger: console,
    });
  }
  return umzug;
}

export async function getUmzugWithMeta(sequelize: Sequelize): Promise<{
  umzug: Umzug<QueryInterface>;
  migrations: number;
  executed: number;
  pending: number;
  lastExecuted: string | undefined;
  rollbackTo: string | undefined;
}> {
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
    rollbackTo: pending.length > 1 ? pending[0]?.name : undefined,
  };
}

// export the type helper exposed by umzug, which will have the `context` argument typed correctly
export type Migration = (params: MigrationParams<QueryInterface>) => Promise<unknown>;

async function updateDB(sequelize: Sequelize): Promise<MigrationMeta[]> {
  const prefix = `[--- SEQUELIZE ---] `;
  const { umzug, migrations, executed, pending, lastExecuted, rollbackTo } = await getUmzugWithMeta(
    sequelize
  );
  console.log(
    `${prefix}Migrations: ${executed} executed, ${pending} pending, ` +
      `${migrations} total, last executed: ${lastExecuted}, rollback to: ${rollbackTo}`
  );
  try {
    // Execute all migrations that are not yet executed
    return await umzug.up();
  } catch (error) {
    const mainMsg = `${prefix}Error running migrations`;
    const rollbackInfo = rollbackTo ? `, rolling back to last executed migration` : "";
    console.error(`${mainMsg}${rollbackInfo}`);
    const failedMigration = error instanceof MigrationError ? error.migration.name : undefined;
    try {
      if (rollbackTo && rollbackTo !== failedMigration) await umzug.down({ to: rollbackTo });
      else console.error(`${mainMsg}, nothing to rolling back to`);
    } catch (error2) {
      const msg = `${prefix}ERROR rolling back to last executed migration`;
      console.error(`${msg}: ${lastExecuted}`, error2);
      throw new MetriportError(msg, error2, {
        originalError: String(error),
        additionalContext: msg,
      });
    }
    throw error;
  }
}

export default updateDB;

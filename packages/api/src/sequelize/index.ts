import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { QueryInterface, Sequelize } from "sequelize";
import { MigrationError, MigrationMeta, MigrationParams, SequelizeStorage, Umzug } from "umzug";
import { Config } from "../shared/config";

let umzug: Umzug<QueryInterface> | undefined = undefined;

/*
  DB migrations run as .js on the cloud, and as .ts locally.
  This impacts how we handle migrations AND ROLLBACKS against local DB vs. cloud DB.

  IMPORTANT: if you need to rollback/revert a migration on the cloud:
  - make sure you have your local environment up-to-date with the branch that represents
    the cloud environment you're working agains (develop or master)
  - build the api `npm run build`
  - update `migrationsPath` to use LOCAL POINTING TO CLOUD PATH option
  - check the pending migrations: `npm run db:pending`
  - identify how many migrations you need to revert
  - GET A SHOULDER CHECK - probably good to pair-program/huddle running this
  - once you confirm that's what you need to do, revert the migrations with
    - `npm run db -- down --step <number of migrations to revert>`
*/
// LOCAL POINTING TO CLOUD - NEVER TO BE COMMITTED
// const migrationsPath = "dist/sequelize/migrations/*.js";
// REGULAR DEV and CLOUD CODE
const migrationsPath = Config.isCloudEnv()
  ? "packages/api/dist/sequelize/migrations/*.js" // Don't touch this, read above ^
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
  pending: MigrationMeta[];
  pendingCount: number;
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
    pending,
    pendingCount: pending.length,
    lastExecuted: executed[executed.length - 1]?.name,
    rollbackTo: pending.length > 1 ? pending[0]?.name : undefined,
  };
}

// export the type helper exposed by umzug, which will have the `context` argument typed correctly
export type Migration = (params: MigrationParams<QueryInterface>) => Promise<unknown>;

async function updateDB(sequelize: Sequelize): Promise<MigrationMeta[]> {
  const prefix = `[--- SEQUELIZE ---] `;
  const {
    umzug,
    migrations,
    executed,
    pendingCount: pending,
    lastExecuted,
    rollbackTo,
  } = await getUmzugWithMeta(sequelize);
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

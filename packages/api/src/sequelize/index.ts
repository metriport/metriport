import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { QueryInterface, Sequelize } from "sequelize";
import { MigrationError, MigrationMeta, MigrationParams, SequelizeStorage, Umzug } from "umzug";
import { Config } from "../shared/config";

let umzugMigrater: Umzug<QueryInterface> | undefined = undefined;
let umzugSeeder: Umzug<QueryInterface> | undefined = undefined;

const migrationsPath = Config.isCloudEnv()
  ? "packages/api/dist/sequelize/migrations/*.js"
  : "src/sequelize/migrations/*.ts";

const seedsPath = Config.isCloudEnv()
  ? "packages/api/dist/sequelize/seeds/*.js"
  : "src/sequelize/seeds/*.ts";

function constructUmzugClient(sequelize: Sequelize, path: string): Umzug<QueryInterface> {
  return new Umzug({
    migrations: { glob: path },
    context: sequelize.getQueryInterface(),
    storage: new SequelizeStorage({ sequelize }),
    logger: console,
  });
}

export function getUmzug(sequelize: Sequelize, mode: string): Umzug<QueryInterface> {
  if (mode === "migrate") {
    if (!umzugMigrater) {
      umzugMigrater = constructUmzugClient(sequelize, migrationsPath);
    }
    return umzugMigrater;
  } else if (mode === "seed") {
    if (!umzugSeeder) {
      umzugSeeder = constructUmzugClient(sequelize, seedsPath);
    }
    return umzugSeeder;
  }
  throw new Error(`Invalid mode: ${mode}`);
}

export async function getUmzugWithMeta(
  sequelize: Sequelize,
  mode: string
): Promise<{
  umzug: Umzug<QueryInterface>;
  migrations: number;
  executed: number;
  pending: number;
  lastExecuted: string | undefined;
  rollbackTo: string | undefined;
}> {
  const queryInterface = sequelize.getQueryInterface();
  const umzug = getUmzug(sequelize, mode);
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

async function updateDB(sequelize: Sequelize, mode: "migrate" | "seed"): Promise<MigrationMeta[]> {
  const prefix = `[--- SEQUELIZE: ${mode.toLocaleUpperCase()} ---] `;
  const { umzug, migrations, executed, pending, lastExecuted, rollbackTo } = await getUmzugWithMeta(
    sequelize,
    mode
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

export async function migrateDB(sequelize: Sequelize): Promise<MigrationMeta[]> {
  return updateDB(sequelize, "migrate");
}

export async function seedDB(sequelize: Sequelize): Promise<MigrationMeta[]> {
  return updateDB(sequelize, "seed");
}

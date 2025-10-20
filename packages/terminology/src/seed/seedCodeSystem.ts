import { v4 as uuidv4 } from "uuid";
import { DbClient } from "../sqlClient";
import { umlsSources } from "./classes";

export async function seedCodeSystems(client: DbClient): Promise<void> {
  for (const source of Object.values(umlsSources)) {
    const result = await client.selectOne('SELECT "id" FROM "code_system" WHERE "system" = ?', [
      source.system,
    ]);

    if (!result) {
      const uuid = uuidv4();
      const resource = { ...source.resource, id: uuid };
      await client.run('INSERT INTO "code_system" ("id", "system", "content") VALUES (?, ?, ?)', [
        uuid,
        source.system,
        JSON.stringify(resource),
      ]);
    }
  }
}

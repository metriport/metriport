import { v4 as uuidv4 } from "uuid";
import { TermServerClient } from "../sqlClient";
import { umlsSources } from "./seedUmlsLookup";

export async function seedCodeSystems(client: TermServerClient): Promise<void> {
  for (const source of Object.values(umlsSources)) {
    const result = await client.selectOne('SELECT "id" FROM "CodeSystem" WHERE "system" = ?', [
      source.system,
    ]);

    if (!result) {
      const uuid = uuidv4();
      const resource = { ...source.resource, id: uuid };
      await client.run('INSERT INTO "CodeSystem" ("id", "system", "content") VALUES (?, ?, ?)', [
        uuid,
        source.system,
        JSON.stringify(resource),
      ]);
    }
  }
}

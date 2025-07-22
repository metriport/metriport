import fs from "fs";
import path from "path";
import { RxNormEntity } from "@aws-sdk/client-comprehendmedical";

export function makeRxNormEntity(name: string): RxNormEntity {
  const entityPath = path.join(__dirname, "artifact/rxnorm-entity", name + ".json");
  return JSON.parse(fs.readFileSync(entityPath, "utf8")) as RxNormEntity;
}

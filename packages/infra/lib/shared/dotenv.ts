import * as dotenv from "dotenv";

export function loadExternalDotEnv(filePath = ".env") {
  dotenv.config({ path: filePath });
}

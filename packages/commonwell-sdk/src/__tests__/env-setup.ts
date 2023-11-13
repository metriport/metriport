import * as dotenv from "dotenv";
import path from "path";
const cwd = process.cwd();
const paths = [cwd, ...(cwd.includes("packages") ? [] : ["packages", "commonwell-sdk"])];
dotenv.config({ path: path.resolve(...paths, ".env") });
// Keep dotenv import and config before everything else

import * as dotenv from "dotenv";
import path from "path";
import { isE2E } from "./shared";
const cwd = process.cwd();
const dotEnvFile = isE2E() ? ".env" : ".env.test";
const paths = [cwd, ...(cwd.includes("packages") ? [] : ["packages", "api"])];
dotenv.config({ path: path.resolve(...paths, dotEnvFile) });
// Keep dotenv import and config before everything else

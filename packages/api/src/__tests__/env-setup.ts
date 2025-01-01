import * as dotenv from "dotenv";
import path from "path";
const cwd = process.cwd();
const paths = [cwd, ...(cwd.includes("packages") ? [] : ["packages", "api"])];
dotenv.config({ path: path.resolve(...paths, ".env") });
dotenv.config({ path: path.resolve(...paths, ".env.test") });
// Keep dotenv import and config before everything else
import fs from "fs";
import * as matchers from "jest-extended";
import { e2eResultsFolderName } from "./e2e/shared";

expect.extend(matchers);

fs.mkdirSync(e2eResultsFolderName, { recursive: true });

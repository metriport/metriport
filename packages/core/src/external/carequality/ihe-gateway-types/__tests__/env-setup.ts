import * as dotenv from "dotenv";
import path from "path";
const cwd = process.cwd();
const paths = [cwd, ...(cwd.includes("packages") ? [] : ["packages", "ihe-gateway-sdk"])];
dotenv.config({ path: path.resolve(...paths, ".env.test") });
// Keep dotenv import and config before everything else

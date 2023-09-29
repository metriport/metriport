import type { Config } from "@jest/types";
import * as path from "path";

const isE2E = process.env.E2E === "true";

process.env.ENV_TYPE = "development";

const cwd = process.cwd();
const paths = [cwd, ...(cwd.includes("packages") ? [] : ["packages", "api"])];
const tsconfig = path.resolve(...paths, "tsconfig.dev.json");

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testMatch: isE2E
    ? ["**/__tests__/**/(*.)+(spec|test).e2e.[jt]s?(x)"]
    : ["**/__tests__/**/(*.)+(spec|test).[jt]s?(x)"],
  setupFilesAfterEnv: ["./src/__tests__/env-setup.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        // ts-jest configuration goes here
        tsconfig,
      },
    ],
  },
};

export default config;

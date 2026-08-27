import type { Config } from "@jest/types";

process.env["ENV_TYPE"] = "dev";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testMatch: ["**/__tests__/**/(*.)+(spec|test).[jt]s?(x)"],
  setupFilesAfterEnv: ["./src/__tests__/env-setup.ts"],
};

export default config;

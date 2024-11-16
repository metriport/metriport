import type { JestConfigWithTsJest } from "ts-jest";

process.env["ENV_TYPE"] = "development";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testMatch: ["**/__tests__/**/(*.)+(spec|test).[jt]s?(x)"],
  setupFilesAfterEnv: ["./src/__tests__/env-setup.ts"],
};

export default config;

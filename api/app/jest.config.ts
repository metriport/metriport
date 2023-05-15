import type { Config } from "@jest/types";

const isE2E = process.env.E2E === "true";

process.env.ENV_TYPE = "development";
process.env.FHIR_SERVER_URL = "http://localhost:8888";

const config: Config.InitialOptions = {
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testMatch: isE2E
    ? ["**/__tests__/**/(*.)+(spec|test).e2e.[jt]s?(x)"]
    : ["**/__tests__/**/(*.)+(spec|test).[jt]s?(x)"],
};

export default config;

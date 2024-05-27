import type { JestConfigWithTsJest } from "ts-jest";

const config: JestConfigWithTsJest = {
  preset: "ts-jest",
  testEnvironment: "node",
  verbose: true,
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  testMatch: ["**/__tests__/**/(*.)+(spec|test).[jt]s?(x)"],
};

export default config;

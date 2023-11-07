/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { getEnvType } from "../env-var";

const envTypeVarName = "ENV_TYPE";
let originalEnvType: string | undefined = undefined;

beforeAll(() => {
  jest.restoreAllMocks();
});
afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.resetAllMocks();
  originalEnvType = process.env[envTypeVarName];
});
afterEach(() => {
  jest.resetAllMocks();
  process.env[envTypeVarName] = originalEnvType;
});

const setEnvType = (v: string) => (process.env[envTypeVarName] = v);

describe("getEnvType", () => {
  it("returns staging", async () => {
    const expectedEnvType = "staging";
    setEnvType(expectedEnvType);
    const res = getEnvType();
    expect(res).toEqual(expectedEnvType);
  });

  it("returns staging", async () => {
    const expectedEnvType = "sandbox";
    setEnvType(expectedEnvType);
    const res = getEnvType();
    expect(res).toEqual(expectedEnvType);
  });

  it("returns staging", async () => {
    const expectedEnvType = "production";
    setEnvType(expectedEnvType);
    const res = getEnvType();
    expect(res).toEqual(expectedEnvType);
  });

  it("fails when development", async () => {
    setEnvType("development");
    expect(() => getEnvType()).toThrow();
  });

  it("fails when invalid envType", async () => {
    setEnvType(faker.lorem.word());
    expect(() => getEnvType()).toThrow();
  });

  it("fails when empty envType", async () => {
    setEnvType("");
    expect(() => getEnvType()).toThrow();
  });
});

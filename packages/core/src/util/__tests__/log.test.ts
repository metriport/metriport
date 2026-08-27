import { faker } from "@faker-js/faker";
import { log as _log } from "../log";

// Mock chalk to return passthrough functions so tests get plain text output
jest.mock("chalk", () => ({
  cyan: (s: string) => s,
  yellow: (s: string) => s,
  green: (s: string) => s,
  magenta: (s: string) => s,
  blue: (s: string) => s,
  gray: (s: string) => s,
  dim: (s: string) => s,
  red: (s: string) => s,
}));

let consoleLog_mock: jest.SpyInstance;

beforeAll(() => {
  consoleLog_mock = jest.spyOn(global.console, "log");
});
beforeEach(() => {
  consoleLog_mock.mockClear();
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe("log", () => {
  it("logs msg without prefix", async () => {
    const msg = faker.lorem.sentence();
    const log = _log();
    log(msg);
    expect(consoleLog_mock).toHaveBeenCalledWith(msg);
  });

  it("logs msg with prefix", async () => {
    const prefix = faker.lorem.word();
    const msg = faker.lorem.sentence();
    const log = _log(prefix);
    log(msg);
    expect(consoleLog_mock).toHaveBeenCalledWith(`[${prefix}] ${msg}`);
  });

  it("logs msg with suffix", async () => {
    const prefix = faker.lorem.word();
    const suffix = faker.lorem.word();
    const msg = faker.lorem.sentence();
    const log = _log(prefix, suffix);
    log(msg);
    expect(consoleLog_mock).toHaveBeenCalledWith(`[${prefix}] ${msg}`, suffix);
  });

  it("logs msg additional string param", async () => {
    const prefix = faker.lorem.word();
    const msg = faker.lorem.sentence();
    const log = _log(prefix);
    const param = faker.lorem.word();
    log(msg, param);
    expect(consoleLog_mock).toHaveBeenCalledWith(`[${prefix}] ${msg}`, param);
  });

  it("logs msg additional number param", async () => {
    const prefix = faker.lorem.word();
    const msg = faker.lorem.sentence();
    const log = _log(prefix);
    const param = faker.number.int();
    log(msg, param);
    expect(consoleLog_mock).toHaveBeenCalledWith(`[${prefix}] ${msg}`, param);
  });

  it("logs msg additional boolean param", async () => {
    const prefix = faker.lorem.word();
    const msg = faker.lorem.sentence();
    const log = _log(prefix);
    const param = faker.datatype.boolean();
    log(msg, param);
    expect(consoleLog_mock).toHaveBeenCalledWith(`[${prefix}] ${msg}`, param);
  });

  it("logs msg additional function param", async () => {
    const prefix = faker.lorem.word();
    const msg = faker.lorem.sentence();
    const log = _log(prefix);
    const paramStr = faker.lorem.word();
    function param() {
      return paramStr;
    }
    log(msg, param);
    expect(consoleLog_mock).toHaveBeenCalledWith(`[${prefix}] ${msg}`, param());
  });
});

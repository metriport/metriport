import { isDryRun } from "../types";
import { makeParamsCx, makeParamsOps } from "./types";

describe("types", () => {
  describe("isDryRun", () => {
    it(`returns false if paramsCx and paramsOps' dryRun are undefined`, async () => {
      const result = isDryRun({ paramsCx: makeParamsCx(), paramsOps: makeParamsOps() });
      expect(result).toBe(false);
    });

    it(`returns true if paramsCx.dryRun is true and paramsOps.dryRun is undefined`, async () => {
      const result = isDryRun({
        paramsCx: makeParamsCx({ dryRun: true }),
        paramsOps: makeParamsOps(),
      });
      expect(result).toBe(true);
    });

    it(`returns false if paramsCx.dryRun is false and paramsOps.dryRun is undefined`, async () => {
      const result = isDryRun({
        paramsCx: makeParamsCx({ dryRun: false }),
        paramsOps: makeParamsOps(),
      });
      expect(result).toBe(false);
    });

    it(`returns true if paramsCx.dryRun is undefined and paramsOps.dryRun is true`, async () => {
      const result = isDryRun({
        paramsCx: makeParamsCx(),
        paramsOps: makeParamsOps({ dryRun: true }),
      });
      expect(result).toBe(true);
    });

    it(`returns false if paramsCx.dryRun is undefined and paramsOps.dryRun is false`, async () => {
      const result = isDryRun({
        paramsCx: makeParamsCx(),
        paramsOps: makeParamsOps({ dryRun: false }),
      });
      expect(result).toBe(false);
    });

    it(`returns false if paramsCx.dryRun and paramsOps.dryRun are false`, async () => {
      const result = isDryRun({
        paramsCx: makeParamsCx({ dryRun: false }),
        paramsOps: makeParamsOps({ dryRun: false }),
      });
      expect(result).toBe(false);
    });

    it(`returns true if paramsCx.dryRun is false and paramsOps.dryRun is true`, async () => {
      const result = isDryRun({
        paramsCx: makeParamsCx({ dryRun: false }),
        paramsOps: makeParamsOps({ dryRun: true }),
      });
      expect(result).toBe(true);
    });

    it(`returns false if paramsCx.dryRun is true and paramsOps.dryRun is false`, async () => {
      const result = isDryRun({
        paramsCx: makeParamsCx({ dryRun: true }),
        paramsOps: makeParamsOps({ dryRun: false }),
      });
      expect(result).toBe(false);
    });

    it(`returns true if paramsCx.dryRun is true and paramsOps.dryRun is true`, async () => {
      const result = isDryRun({
        paramsCx: makeParamsCx({ dryRun: true }),
        paramsOps: makeParamsOps({ dryRun: true }),
      });
      expect(result).toBe(true);
    });
  });
});

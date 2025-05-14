import { Bundle } from "@medplum/fhirtypes";
import fs from "fs";
import path from "path";
import { computeResourcesXorAlongResourceType } from "../compute-resources-xor";

const testCondition1: Bundle = JSON.parse(
  fs.readFileSync(`${path.dirname(__dirname)}/__tests__/bundles/conditions/source.json`, "utf8")
);

const testCondition2: Bundle = JSON.parse(
  fs.readFileSync(`${path.dirname(__dirname)}/__tests__/bundles/conditions/target.json`, "utf8")
);

describe("combineTwoResources", () => {
  it("keeps the id of the first condition", () => {
    const resources1 =
      testCondition1.entry?.flatMap(entry => {
        if (!entry.resource) {
          return [];
        }
        return [entry.resource];
      }) ?? [];
    const resources2 =
      testCondition2.entry?.flatMap(entry => {
        if (!entry.resource) {
          return [];
        }
        return [entry.resource];
      }) ?? [];
    const { computedXorSourceResources, computedXorTargetResources } =
      computeResourcesXorAlongResourceType({
        sourceResources: resources1,
        targetResources: resources2,
      });
    expect(computedXorSourceResources.length).toBe(3);
    expect(computedXorTargetResources.length).toBe(2);
    const sourceIds = computedXorSourceResources.map(resource => resource?.id);
    const targetIds = computedXorTargetResources.map(resource => resource?.id);
    expect(sourceIds).toEqual(
      expect.arrayContaining([
        "914829dd-f3cc-4c39-8aa1-d8ae7041b6f1",
        "6204fa73-188f-4819-bbed-c7a2cc24ff9b",
        "41c0ef72-73c2-4eaa-b2f6-055660a9daa9",
      ])
    );
    expect(targetIds).toEqual(
      expect.arrayContaining([
        "b9b78ee6-118f-4414-b748-eede96359f02",
        "a0850f7e-43f2-4688-a1e0-758286caf728",
      ])
    );
  });
});

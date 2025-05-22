import { Bundle, Resource } from "@medplum/fhirtypes";
import fs from "fs";
import path from "path";
import { computeResourcesXorAlongResourceType } from "../compute-resources-xor";

const testConditionBundleSource: Bundle = JSON.parse(
  fs.readFileSync(`${path.dirname(__dirname)}/__tests__/bundles/conditions/source.json`, "utf8")
);
const testConditionsSource =
  testConditionBundleSource.entry?.flatMap(entry => {
    if (!entry.resource) {
      return [];
    }
    return [entry.resource];
  }) ?? [];

const testConditionBundleTarget: Bundle = JSON.parse(
  fs.readFileSync(`${path.dirname(__dirname)}/__tests__/bundles/conditions/target.json`, "utf8")
);
const testConditionsTarget =
  testConditionBundleTarget.entry?.flatMap(entry => {
    if (!entry.resource) {
      return [];
    }
    return [entry.resource];
  }) ?? [];

describe("computeResourcesXorAlongResourceType", () => {
  it("correctly splits target and source resources", () => {
    const sourceResources = testConditionsSource;
    const targetResources = testConditionsTarget;
    const { targetOnly, sourceOnly } = computeResourcesXorAlongResourceType({
      sourceResources,
      targetResources,
    });
    expect(sourceOnly.length).toBe(3);
    expect(targetOnly.length).toBe(2);
    const sourceIds = sourceOnly.map(resource => resource?.id);
    const targetIds = targetOnly.map(resource => resource?.id);
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
  it("correctly returns target when source is empty", () => {
    const sourceResources: Resource[] = [];
    const targetResources = testConditionsTarget;
    const { targetOnly, sourceOnly } = computeResourcesXorAlongResourceType({
      sourceResources,
      targetResources,
    });
    expect(sourceOnly.length).toBe(0);
    expect(targetOnly.length).toBe(4);
  });
  it("correctly returns source when target is empty", () => {
    const sourceResources = testConditionsSource;
    const targetResources: Resource[] = [];
    const { targetOnly, sourceOnly } = computeResourcesXorAlongResourceType({
      sourceResources,
      targetResources,
    });
    expect(sourceOnly.length).toBe(5);
    expect(targetOnly.length).toBe(0);
  });
  it("correctly throws on different resource types", () => {
    const sourceResources = testConditionsSource;
    const targetResources: Resource[] = [
      {
        resourceType: "Observation",
      },
    ];
    expect(() =>
      computeResourcesXorAlongResourceType({
        sourceResources,
        targetResources,
      })
    ).toThrow("Target and source resource types must match");
  });
  it("correctly throws on different resource types in source", () => {
    const sourceResources = testConditionsSource;
    const targetResources: Resource[] = [];
    expect(() =>
      computeResourcesXorAlongResourceType({
        sourceResources: [
          ...sourceResources,
          {
            resourceType: "Observation",
          },
        ],
        targetResources,
      })
    ).toThrow("Got more than one source resource type");
  });
  it("correctly throws on different resource types in target", () => {
    const sourceResources: Resource[] = [];
    const targetResources = testConditionsTarget;
    expect(() =>
      computeResourcesXorAlongResourceType({
        sourceResources,
        targetResources: [
          ...targetResources,
          {
            resourceType: "Observation",
          },
        ],
      })
    ).toThrow("Got more than one target resource type");
  });
});

/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Condition, Encounter } from "@medplum/fhirtypes";
import { makeBundle } from "@metriport/core/external/fhir/__tests__/bundle";
import { makeEncounter } from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { validateFhirEntries } from "../json-validator";
import { testBundle } from "./json-validator-bundle1";

describe("validateFhirEntries", () => {
  it(`works w/ single, simple resource`, async () => {
    const encounter = makeEncounter();
    const bundle = makeBundle({ entries: [encounter] });
    bundle.type = "collection";
    const res = validateFhirEntries(bundle);
    expect(res).toBeTruthy();
  });

  it(`fails with invalid resource type and keep IDs`, async () => {
    const encounter = {
      ...makeEncounter(),
      resourceType: "InvalidResourceType",
    } as unknown as Encounter;
    console.log(`encounter.id: ${encounter.id}`);
    expect(encounter.id).toBeTruthy();
    const bundle = makeBundle({ entries: [encounter] });
    bundle.type = "collection";
    expect(() => validateFhirEntries(bundle)).toThrowError(new RegExp(encounter.id!));
  });

  it(`fails with valid and invalid resource type`, async () => {
    const encounter = makeEncounter();
    const condition = {
      ...makeEncounter(),
      resourceType: "InvalidResourceType",
    } as unknown as Condition;
    const bundle = makeBundle({ entries: [encounter, condition] });
    bundle.type = "collection";
    expect(() => validateFhirEntries(bundle)).toThrow();
  });

  // Keep this (or other valid bundle) after the test that fails above
  it(`works with complex data`, async () => {
    const bundle = testBundle;
    bundle.type = "collection";
    const res = validateFhirEntries(bundle);
    expect(res).toBeTruthy();
  });
});

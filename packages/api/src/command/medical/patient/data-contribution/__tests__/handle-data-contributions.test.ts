/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { makeBundle } from "@metriport/core/external/fhir/__tests__/bundle";
import { makePatient } from "@metriport/core/external/fhir/__tests__/patient";
import { makeEncounter } from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-encounter";
import { cloneDeep } from "lodash";
import { cleanupSpecialCharsFromBundle } from "../shared";

jest.mock("@metriport/core/command/consolidated/contribution-bundle-create");

describe("handle-data-contributions", () => {
  describe("cleanupSpecialCharsFromBundle", () => {
    it("does not change a valid bundle", async () => {
      const encounter = makeEncounter();
      const patient = makePatient();
      const bundle = makeBundle({ entries: [patient, encounter] });
      const normalizedBundle = cleanupSpecialCharsFromBundle(bundle);
      expect(normalizedBundle).toEqual(bundle);
    });

    it("replaces nbsp char by space", async () => {
      const encounter = makeEncounter();
      const patient = makePatient({ firstName: "John Denver" });
      const bundle = makeBundle({ entries: [patient, encounter] });
      const patientUpdated = cloneDeep(patient);
      patientUpdated.name = [
        {
          ...patient.name![0],
          given: ["John Denver"],
        },
      ];
      const expectedBundle = {
        ...bundle,
        entry: [{ resource: patientUpdated }, { resource: encounter }],
      };
      const normalizedBundle = cleanupSpecialCharsFromBundle(bundle);
      expect(normalizedBundle).toEqual(expectedBundle);
    });

    it("replaces nbsp code by space", async () => {
      const encounter = makeEncounter();
      const patient = makePatient({ firstName: `John${String.fromCharCode(160)}Denver` });
      const bundle = makeBundle({ entries: [patient, encounter] });
      const patientUpdated = cloneDeep(patient);
      patientUpdated.name = [
        {
          ...patient.name![0],
          given: ["John Denver"],
        },
      ];
      const expectedBundle = {
        ...bundle,
        entry: [{ resource: patientUpdated }, { resource: encounter }],
      };
      const normalizedBundle = cleanupSpecialCharsFromBundle(bundle);
      expect(normalizedBundle).toEqual(expectedBundle);
    });
  });
});

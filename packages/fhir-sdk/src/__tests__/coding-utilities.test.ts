/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { Bundle, Observation, Condition, Coding } from "@medplum/fhirtypes";
import { FhirBundleSdk } from "../index";

describe("Coding System Utilities", () => {
  describe("SmartCoding - Individual Coding Methods", () => {
    const loincCoding: Coding = {
      system: "http://loinc.org",
      code: "8867-4",
      display: "Heart rate",
    };

    const snomedCoding: Coding = {
      system: "http://snomed.info/sct",
      code: "73211009",
      display: "Diabetes mellitus",
    };

    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            id: "obs1",
            status: "final",
            code: {
              coding: [loincCoding, snomedCoding],
            },
          } as Observation,
        },
      ],
    };

    let sdk: FhirBundleSdk;

    beforeAll(async () => {
      sdk = await FhirBundleSdk.create(bundle);
    });

    describe("System checking methods", () => {
      it("should correctly identify LOINC coding", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs).toBeDefined();
        expect(obs?.code?.coding).toBeDefined();
        const coding = obs!.code!.coding![0];
        expect(coding).toBeDefined();
        expect(coding!.isLoinc()).toBe(true);
        expect(coding!.isIcd10()).toBe(false);
        expect(coding!.isSnomed()).toBe(false);
        expect(coding!.isRxNorm()).toBe(false);
        expect(coding!.isNdc()).toBe(false);
      });

      it("should correctly identify SNOMED coding", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs).toBeDefined();
        expect(obs?.code?.coding).toBeDefined();
        const coding = obs!.code!.coding![1];
        expect(coding).toBeDefined();
        expect(coding!.isSnomed()).toBe(true);
        expect(coding!.isLoinc()).toBe(false);
      });
    });

    describe("Code matching methods", () => {
      it("should match specific code", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs).toBeDefined();
        expect(obs?.code?.coding).toBeDefined();
        const coding = obs!.code!.coding![0];
        expect(coding).toBeDefined();
        expect(coding!.matchesCode("8867-4")).toBe(true);
        expect(coding!.matchesCode("wrong-code")).toBe(false);
      });

      it("should match codes from array", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs).toBeDefined();
        expect(obs?.code?.coding).toBeDefined();
        const coding = obs!.code!.coding![0];
        expect(coding).toBeDefined();
        expect(coding!.matchesCodes(["8867-4", "other-code"])).toBe(true);
        expect(coding!.matchesCodes(["wrong-1", "wrong-2"])).toBe(false);
      });
    });
  });

  describe("SmartCodeableConcept - CodeableConcept Methods", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Condition",
            id: "cond1",
            subject: { reference: "Patient/1" },
            code: {
              coding: [
                {
                  system: "http://hl7.org/fhir/sid/icd-10-cm",
                  code: "E11.9",
                  display: "Type 2 diabetes mellitus",
                },
                {
                  system: "http://snomed.info/sct",
                  code: "73211009",
                  display: "Diabetes mellitus",
                },
              ],
              text: "Type 2 Diabetes",
            },
          } as Condition,
        },
        {
          resource: {
            resourceType: "Observation",
            id: "obs1",
            status: "final",
            code: {
              coding: [
                {
                  system: "http://loinc.org",
                  code: "8867-4",
                  display: "Heart rate",
                },
                {
                  system: "http://loinc.org",
                  code: "8310-5",
                  display: "Body temperature",
                },
              ],
            },
          } as Observation,
        },
        {
          resource: {
            resourceType: "Observation",
            id: "obs2",
            status: "final",
            code: {
              text: "No coding array",
            },
          } as Observation,
        },
      ],
    };

    let sdk: FhirBundleSdk;

    beforeAll(async () => {
      sdk = await FhirBundleSdk.create(bundle);
    });

    describe("LOINC methods", () => {
      it("should get first LOINC coding", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs?.code).toBeDefined();
        const loinc = obs!.code!.getLoinc();
        expect(loinc).toBeDefined();
        expect(loinc!.code).toBe("8867-4");
      });

      it("should get all LOINC codings", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs?.code).toBeDefined();
        const loincCodings = obs!.code!.getLoincCodings();
        expect(loincCodings).toHaveLength(2);
        expect(loincCodings[0]!.code).toBe("8867-4");
        expect(loincCodings[1]!.code).toBe("8310-5");
      });

      it("should get first LOINC code value", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs?.code).toBeDefined();
        const code = obs!.code!.getLoincCode();
        expect(code).toBe("8867-4");
      });

      it("should get all LOINC code values", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs?.code).toBeDefined();
        const codes = obs!.code!.getLoincCodes();
        expect(codes).toEqual(["8867-4", "8310-5"]);
      });

      it("should check if has any LOINC", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs?.code).toBeDefined();
        expect(obs!.code!.hasLoinc()).toBe(true);

        const cond = sdk.getConditionById("cond1");
        expect(cond?.code).toBeDefined();
        expect(cond!.code!.hasLoinc()).toBe(false);
      });

      it("should check if has specific LOINC code", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs?.code).toBeDefined();
        expect(obs!.code!.hasLoincCode("8867-4")).toBe(true);
        expect(obs!.code!.hasLoincCode("wrong-code")).toBe(false);
      });

      it("should check if has some LOINC codes", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs?.code).toBeDefined();
        expect(obs!.code!.hasSomeLoinc(["8867-4", "other"])).toBe(true);
        expect(obs!.code!.hasSomeLoinc(["8310-5", "other"])).toBe(true);
        expect(obs!.code!.hasSomeLoinc(["wrong-1", "wrong-2"])).toBe(false);
      });

      it("should find LOINC coding with predicate", () => {
        const obs = sdk.getObservationById("obs1");
        expect(obs?.code).toBeDefined();
        const found = obs!.code!.findLoincCoding((code: string) => code === "8310-5");
        expect(found).toBeDefined();
        expect(found!.code).toBe("8310-5");

        const notFound = obs!.code!.findLoincCoding((code: string) => code === "wrong");
        expect(notFound).toBeUndefined();
      });
    });

    describe("ICD-10 methods", () => {
      it("should get first ICD-10 coding", () => {
        const cond = sdk.getConditionById("cond1");
        expect(cond?.code).toBeDefined();
        const icd10 = cond!.code!.getIcd10();
        expect(icd10).toBeDefined();
        expect(icd10!.code).toBe("E11.9");
      });

      it("should get all ICD-10 codings", () => {
        const cond = sdk.getConditionById("cond1");
        expect(cond?.code).toBeDefined();
        const icd10Codings = cond!.code!.getIcd10Codings();
        expect(icd10Codings).toHaveLength(1);
        expect(icd10Codings[0]!.code).toBe("E11.9");
      });

      it("should check if has ICD-10", () => {
        const cond = sdk.getConditionById("cond1");
        expect(cond?.code).toBeDefined();
        expect(cond!.code!.hasIcd10()).toBe(true);

        const obs = sdk.getObservationById("obs1");
        expect(obs?.code).toBeDefined();
        expect(obs!.code!.hasIcd10()).toBe(false);
      });

      it("should check if has specific ICD-10 code", () => {
        const cond = sdk.getConditionById("cond1");
        expect(cond?.code).toBeDefined();
        expect(cond!.code!.hasIcd10Code("E11.9")).toBe(true);
        expect(cond!.code!.hasIcd10Code("wrong")).toBe(false);
      });

      it("should check if has some ICD-10 codes", () => {
        const cond = sdk.getConditionById("cond1");
        expect(cond?.code).toBeDefined();
        expect(cond!.code!.hasSomeIcd10(["E11.9", "other"])).toBe(true);
        expect(cond!.code!.hasSomeIcd10(["wrong-1", "wrong-2"])).toBe(false);
      });
    });

    describe("SNOMED methods", () => {
      it("should get first SNOMED coding", () => {
        const cond = sdk.getConditionById("cond1");
        expect(cond?.code).toBeDefined();
        const snomed = cond!.code!.getSnomed();
        expect(snomed).toBeDefined();
        expect(snomed!.code).toBe("73211009");
      });

      it("should check if has SNOMED", () => {
        const cond = sdk.getConditionById("cond1");
        expect(cond?.code).toBeDefined();
        expect(cond!.code!.hasSnomed()).toBe(true);
      });

      it("should check if has specific SNOMED code", () => {
        const cond = sdk.getConditionById("cond1");
        expect(cond?.code).toBeDefined();
        expect(cond!.code!.hasSnomedCode("73211009")).toBe(true);
        expect(cond!.code!.hasSnomedCode("wrong")).toBe(false);
      });
    });

    describe("Edge cases", () => {
      it("should handle undefined coding array", () => {
        const obs = sdk.getObservationById("obs2");
        expect(obs?.code).toBeDefined();
        expect(obs!.code!.getLoinc()).toBeUndefined();
        expect(obs!.code!.getLoincCodings()).toEqual([]);
        expect(obs!.code!.getLoincCode()).toBeUndefined();
        expect(obs!.code!.getLoincCodes()).toEqual([]);
        expect(obs!.code!.hasLoinc()).toBe(false);
        expect(obs!.code!.hasLoincCode("any")).toBe(false);
        expect(obs!.code!.hasSomeLoinc(["any"])).toBe(false);
      });

      it("should handle empty coding array", () => {
        const emptyBundle: Bundle = {
          resourceType: "Bundle",
          type: "collection",
          entry: [
            {
              resource: {
                resourceType: "Observation",
                id: "obs-empty",
                status: "final",
                code: {
                  coding: [],
                  text: "Empty codings",
                },
              } as Observation,
            },
          ],
        };
        const emptySdk = FhirBundleSdk.createSync(emptyBundle);
        const obs = emptySdk.getObservationById("obs-empty");
        expect(obs?.code).toBeDefined();
        expect(obs!.code!.hasLoinc()).toBe(false);
      });
    });
  });

  describe("Deep nesting - Transparent Proxy", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            id: "obs1",
            status: "final",
            code: {
              coding: [
                {
                  system: "http://loinc.org",
                  code: "8867-4",
                  display: "Heart rate",
                },
              ],
            },
            component: [
              {
                code: {
                  coding: [
                    {
                      system: "http://loinc.org",
                      code: "8310-5",
                      display: "Body temperature",
                    },
                  ],
                },
              },
            ],
          } as Observation,
        },
      ],
    };

    let sdk: FhirBundleSdk;

    beforeAll(async () => {
      sdk = await FhirBundleSdk.create(bundle);
    });

    it("should wrap CodeableConcept in nested component arrays", () => {
      const obs = sdk.getObservationById("obs1");
      expect(obs?.component).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const component = obs!.component![0] as any;
      expect(component?.code).toBeDefined();

      // Should have smart methods on nested CodeableConcept
      expect(component!.code!.hasLoinc()).toBe(true);
      expect(component!.code!.hasLoincCode("8310-5")).toBe(true);
    });

    it("should wrap Coding in deeply nested structures", () => {
      const obs = sdk.getObservationById("obs1");
      expect(obs?.component).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const component = obs!.component![0] as any;
      expect(component?.code?.coding).toBeDefined();
      const componentCoding = component!.code!.coding![0];
      expect(componentCoding).toBeDefined();

      // Should have smart methods on nested Coding
      expect(componentCoding!.isLoinc()).toBe(true);
      expect(componentCoding!.matchesCode("8310-5")).toBe(true);
    });
  });

  describe("Integration - Filtering by coding", () => {
    const bundle: Bundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "Observation",
            id: "obs1",
            status: "final",
            code: {
              coding: [
                {
                  system: "http://loinc.org",
                  code: "8867-4",
                  display: "Heart rate",
                },
              ],
            },
          } as Observation,
        },
        {
          resource: {
            resourceType: "Observation",
            id: "obs2",
            status: "final",
            code: {
              coding: [
                {
                  system: "http://loinc.org",
                  code: "8310-5",
                  display: "Body temperature",
                },
              ],
            },
          } as Observation,
        },
        {
          resource: {
            resourceType: "Observation",
            id: "obs3",
            status: "final",
            code: {
              coding: [
                {
                  system: "http://snomed.info/sct",
                  code: "271649006",
                  display: "Systolic blood pressure",
                },
              ],
            },
          } as Observation,
        },
      ],
    };

    let sdk: FhirBundleSdk;

    beforeAll(async () => {
      sdk = await FhirBundleSdk.create(bundle);
    });

    it("should filter observations by LOINC codes", () => {
      const vitals = sdk
        .getObservations()
        .filter(obs => obs.code?.hasSomeLoinc(["8867-4", "8310-5"]) ?? false);

      expect(vitals).toHaveLength(2);
      expect(vitals[0]?.id).toBe("obs1");
      expect(vitals[1]?.id).toBe("obs2");
    });

    it("should filter observations by specific coding system", () => {
      const loincObs = sdk.getObservations().filter(obs => obs.code?.hasLoinc() ?? false);
      expect(loincObs).toHaveLength(2);

      const snomedObs = sdk.getObservations().filter(obs => obs.code?.hasSnomed() ?? false);
      expect(snomedObs).toHaveLength(1);
      expect(snomedObs[0]?.id).toBe("obs3");
    });

    it("should filter and map to extract codes", () => {
      const loincCodes = sdk
        .getObservations()
        .filter(obs => obs.code?.hasLoinc() ?? false)
        .map(obs => obs.code!.getLoincCode())
        .filter((code): code is string => code !== undefined);

      expect(loincCodes).toEqual(["8867-4", "8310-5"]);
    });
  });
});

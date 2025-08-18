/* eslint-disable @typescript-eslint/no-explicit-any */
import { Encounter } from "@medplum/fhirtypes";
import { deepMerge, pickMostSevereClass, dangerouslyAssignMostSevereClass } from "../shared";

describe("deepMerge", () => {
  it("keeps the target 'display' value when source is 'unknown'", () => {
    const target = {
      class: {
        system: "http://www.ama-assn.org/go/cpt",
        code: "99214",
        display: "OFFICE O/P EST MOD 30-39 MIN",
      },
    };
    const source = {
      class: {
        system: "http://www.ama-assn.org/go/cpt",
        code: "99214",
        display: "unknown",
      },
    };
    const result = deepMerge(target, source, true);
    expect(result.class.display).toEqual("OFFICE O/P EST MOD 30-39 MIN");
  });

  it("uses the source 'display' value when it's not 'unknown'", () => {
    const target = {
      class: {
        system: "http://www.ama-assn.org/go/cpt",
        code: "99214",
        display: "unknown",
      },
    };
    const source = {
      class: {
        system: "http://www.ama-assn.org/go/cpt",
        code: "99214",
        display: "OFFICE O/P EST MOD 30-39 MIN",
      },
    };
    const result = deepMerge(target, source, true);
    expect(result.class.display).toEqual("OFFICE O/P EST MOD 30-39 MIN");
  });
});

describe("pickMostSevereClass", () => {
  it("returns the more severe class when both have correct case", () => {
    const class1 = { code: "AMB" as const };
    const class2 = { code: "ACUTE" as const };
    const result = pickMostSevereClass(class1, class2);
    expect(result).toEqual(class2); // ACUTE is more severe than AMB
  });

  it("normalizes capitalization and picks the more severe class", () => {
    const class1 = { code: "amb" } as any; // lowercase - type assertion needed for test
    const class2 = { code: "ACUTE" as const };
    const result = pickMostSevereClass(class1, class2);
    expect(result).toEqual(class2); // ACUTE is more severe than AMB
  });

  it("normalizes mixed case and picks correctly", () => {
    const class1 = { code: "Acute" } as any; // mixed case - type assertion needed for test
    const class2 = { code: "imp" } as any; // lowercase - type assertion needed for test
    const result = pickMostSevereClass(class1, class2);
    expect(result).toEqual(class1); // ACUTE is more severe than IMP
  });

  it("returns undefined when both classes are undefined", () => {
    const result = pickMostSevereClass(undefined, undefined);
    expect(result).toBeUndefined();
  });

  it("returns undefined when both classes have no code", () => {
    const class1 = {} as any;
    const class2 = {} as any;
    const result = pickMostSevereClass(class1, class2);
    expect(result).toBeUndefined();
  });
});

describe("dangerouslyAssignMostSevereClass", () => {
  const HL7_ACT_URL = "http://terminology.hl7.org/CodeSystem/v3-ActCode";

  it("assigns the most severe class to both encounters when both have valid ActCoding", () => {
    const existing: Encounter = {
      resourceType: "Encounter",
      status: "finished",
      class: {
        system: HL7_ACT_URL,
        code: "AMB", // Ambulatory - less severe
        display: "Ambulatory",
      },
    };

    const target: Encounter = {
      resourceType: "Encounter",
      status: "finished",
      class: {
        system: HL7_ACT_URL,
        code: "ACUTE", // Acute - more severe
        display: "Acute",
      },
    };

    dangerouslyAssignMostSevereClass(existing, target);

    // Both should now have the more severe "ACUTE" class
    expect(existing.class?.code).toBe("ACUTE");
    expect(existing.class?.display).toBe("Acute");
    expect(target.class?.code).toBe("ACUTE");
    expect(target.class?.display).toBe("Acute");
  });

  it("does not modify encounters when one has invalid ActCoding system", () => {
    const existing: Encounter = {
      resourceType: "Encounter",
      status: "finished",
      class: {
        system: "http://invalid-system.org", // Invalid system
        code: "AMB",
        display: "Ambulatory",
      },
    };

    const target: Encounter = {
      resourceType: "Encounter",
      status: "finished",
      class: {
        system: HL7_ACT_URL,
        code: "ACUTE",
        display: "Acute",
      },
    };

    const originalExistingCode = existing.class?.code;
    const originalTargetCode = target.class?.code;

    dangerouslyAssignMostSevereClass(existing, target);

    // Both should remain unchanged
    expect(existing.class?.code).toBe(originalExistingCode);
    expect(target.class?.code).toBe(originalTargetCode);
  });

  it("does not modify encounters when most severe class has no code", () => {
    const existing: Encounter = {
      resourceType: "Encounter",
      status: "finished",
      class: {
        system: HL7_ACT_URL,
        // No code property - this will make pickMostSevereClass return undefined
        display: "Some display",
      },
    };

    const target: Encounter = {
      resourceType: "Encounter",
      status: "finished",
      class: {
        system: HL7_ACT_URL,
        // No code property - this will make pickMostSevereClass return undefined
        display: "Another display",
      },
    };

    const originalExistingDisplay = existing.class?.display;
    const originalTargetDisplay = target.class?.display;

    dangerouslyAssignMostSevereClass(existing, target);

    // Both should remain unchanged since pickMostSevereClass returns undefined
    expect(existing.class?.display).toBe(originalExistingDisplay);
    expect(target.class?.display).toBe(originalTargetDisplay);
    expect(existing.class?.code).toBeUndefined();
    expect(target.class?.code).toBeUndefined();
  });
});

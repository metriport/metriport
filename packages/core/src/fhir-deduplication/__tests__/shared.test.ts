/* eslint-disable @typescript-eslint/no-explicit-any */
import { deepMerge, pickMostSevereClass } from "../shared";

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

import { deepMerge } from "../shared";

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

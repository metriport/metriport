import { mergeWithLeastCommonSubstring } from "../strategy/util/least-common-substring";

describe("Least common substring test", () => {
  it("should merge two identical strings", () => {
    const str = "The quick brown fox jumps over the lazy dog";
    const result = mergeWithLeastCommonSubstring(str, str);
    expect(result).toEqual("The quick brown fox jumps over the lazy dog");
  });

  it("should merge two strings with the same casing to the same roughly equivalent string", () => {
    const a = "The quick brown fox jumps over the lazy dog";
    const b = "the QUICK brown fox jumps OVER the lazy dog";
    const result = mergeWithLeastCommonSubstring(a, b);
    expect(result).toEqual("The quick brown fox jumps over the lazy dog");
  });

  it("should merge two different strings", () => {
    const note1 = "follow up recommended";
    const note2 = "follow up in two weeks";

    const result = mergeWithLeastCommonSubstring(note1, note2);
    expect(result).toEqual("follow up in two weeks recommended");
  });

  it("should merge strings with commas", () => {
    const note1 = "patient denies chest pain.";
    const note2 = "patient denies chest pain, reports dyspnea.";

    const result = mergeWithLeastCommonSubstring(note1, note2);
    expect(result).toEqual("patient denies chest pain, reports dyspnea.");
  });
});

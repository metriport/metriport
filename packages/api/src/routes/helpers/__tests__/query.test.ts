import QueryString from "qs";
import { queryToSearchParams } from "../query";

describe("queryToSearchParams", () => {
  it("returns empty when gets empty", () => {
    const res = queryToSearchParams({});
    expect(res).toBeInstanceOf(URLSearchParams);
    expect(res).toEqual(new URLSearchParams());
  });

  it("returns empty when gets undefined", () => {
    const res = queryToSearchParams(undefined as unknown as QueryString.ParsedQs);
    expect(res).toBeInstanceOf(URLSearchParams);
    expect(res).toEqual(new URLSearchParams());
  });

  it("returns params when simple strings", () => {
    const expected = new URLSearchParams();
    expected.append("a", "1");
    expected.append("b", "2");
    const res = queryToSearchParams({
      a: "1",
      b: "2",
    });
    expect(res).toBeInstanceOf(URLSearchParams);
    expect(res).toEqual(expected);
  });

  it("returns multiple entries of the same param", () => {
    const expected = new URLSearchParams();
    expected.append("a", "1");
    expected.append("a", "2");
    const res = queryToSearchParams({ a: ["1", "2"] });
    expect(res).toBeInstanceOf(URLSearchParams);
    expect(res).toEqual(expected);
  });

  it("returns mixed simple params and multiple entries of the same param", () => {
    const expected = new URLSearchParams();
    expected.append("a", "1");
    expected.append("a", "2");
    expected.append("b", "3");
    const res = queryToSearchParams({ a: ["1", "2"], b: "3" });
    expect(res).toBeInstanceOf(URLSearchParams);
    expect(res).toEqual(expected);
  });
});

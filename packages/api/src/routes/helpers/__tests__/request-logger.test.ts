import { describe, it, expect } from "@jest/globals";
import { splitUrlToClientAndPath } from "../request-logger";

describe("splitUrlToClientAndPath", () => {
  it("should return only path when no client is present", () => {
    const url = "/medical/v1/patients";
    const result = splitUrlToClientAndPath(url);
    expect(result).toEqual({
      client: undefined,
      path: "/medical/v1/patients",
    });
  });

  it("should extract client and path when client is present", () => {
    const url = "/acme-corp/medical/v1/patients";
    const result = splitUrlToClientAndPath(url);
    expect(result).toEqual({
      client: "acme-corp",
      path: "/medical/v1/patients",
    });
  });

  it("should handle multi-segment client paths", () => {
    const url = "/org/acme-corp/medical/v1/patients";
    const result = splitUrlToClientAndPath(url);
    expect(result).toEqual({
      client: "org acme-corp",
      path: "/medical/v1/patients",
    });
  });

  it("should return only path when separator is not found", () => {
    const url = "/some/random/path";
    const result = splitUrlToClientAndPath(url);
    expect(result).toEqual({
      client: undefined,
      path: "/some/random/path",
    });
  });

  it("should handle empty string", () => {
    const url = "";
    const result = splitUrlToClientAndPath(url);
    expect(result).toEqual({
      client: undefined,
      path: "",
    });
  });
});

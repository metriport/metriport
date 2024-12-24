import { getAiBriefContentFromBundle } from "../command/ai-brief/shared";
import { makeBundle } from "../external/fhir/__tests__/bundle";

describe("getAiBriefContentFromBundle", () => {
  it("returns undefined when bundle has no Binary resource", () => {
    const bundle = makeBundle({ entries: [] });
    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBeUndefined();
  });

  it("returns undefined when bundle has invalid Binary resource", () => {
    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          // missing required fields
        },
      ],
    });
    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBeUndefined();
  });

  it("returns undefined when Binary resource has no data", () => {
    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          contentType: "text/plain",
          // data field missing
        },
      ],
    });
    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBeUndefined();
  });

  it("returns undefined when Binary resource has wrong meta source", () => {
    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          meta: {
            source: "some-other-source",
          },
          contentType: "text/plain",
          data: "test-data",
        },
      ],
    });
    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBeUndefined();
  });

  it("returns decoded content when Binary resource has correct meta source", () => {
    const content = "Test AI Brief Content";
    const encodedContent = Buffer.from(content).toString("base64");

    const bundle = makeBundle({
      entries: [
        {
          resourceType: "Binary",
          id: "123",
          meta: {
            source: "metriport:ai-generated-brief",
          },
          contentType: "text/plain",
          data: encodedContent,
        },
      ],
    });

    const result = getAiBriefContentFromBundle(bundle);
    expect(result).toBe(content);
  });
});

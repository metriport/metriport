import { stripUrnPrefix, stripBrackets } from "../urn";

beforeEach(() => {
  jest.restoreAllMocks();
});

describe("stripUrnPrefix", () => {
  it("returns empty string when gets undefined", async () => {
    const res = stripUrnPrefix(undefined);
    expect(res).toEqual("");
  });

  it("returns string when gets number", async () => {
    const original = 123;
    const res = stripUrnPrefix(original);
    expect(res).toEqual("123");
  });

  it("returns stripped string when gets urn:oid", async () => {
    const original = "urn:oid:2.16.840.1.113883.3.9621";
    const res = stripUrnPrefix(original);
    expect(res).toEqual("2.16.840.1.113883.3.9621");
  });

  it("returns stripped string when gets urn:uuid", async () => {
    const original = "urn:uuid:2.16.840.1.113883.3.9621";
    const res = stripUrnPrefix(original);
    expect(res).toEqual("2.16.840.1.113883.3.9621");
  });

  it("returns string when its a normal oid", async () => {
    const original = "2.16.840.1.113883.3.9621";
    const res = stripUrnPrefix(original);
    expect(res).toEqual("2.16.840.1.113883.3.9621");
  });
});

describe("stripBrackets", () => {
  it("returns empty string when gets undefined", async () => {
    const res = stripBrackets(undefined);
    expect(res).toEqual("");
  });

  it("returns string when gets number", async () => {
    const original = 123;
    const res = stripBrackets(original);
    expect(res).toEqual("123");
  });

  it("returns stripped string when gets both brackets", async () => {
    const original = "[2.16.840.1.113883.3.9621]";
    const res = stripBrackets(original);
    expect(res).toEqual("2.16.840.1.113883.3.9621");
  });

  it("returns stripped string when gets one left bracket", async () => {
    const original = "[2.16.840.1.113883.3.9621";
    const res = stripBrackets(original);
    expect(res).toEqual("2.16.840.1.113883.3.9621");
  });

  it("returns stripped string when gets one right bracket", async () => {
    const original = "2.16.840.1.113883.3.9621]";
    const res = stripBrackets(original);
    expect(res).toEqual("2.16.840.1.113883.3.9621");
  });

  it("returns unstripped string when gets bracket in middle", async () => {
    const original = "2.16.840.1.[113883.3.9621]";
    const res = stripBrackets(original);
    expect(res).toEqual("2.16.840.1.[113883.3.9621");
  });
});

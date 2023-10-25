import * as fs from "fs";
import {
  OpenSearchFileIngestorDirect,
  OpenSearchFileIngestorDirectConfig,
} from "../file-ingestor-direct";

const fileName = `${__dirname}/test-cda.xml`;

beforeAll(() => {
  jest.restoreAllMocks();
});
beforeEach(() => {
  jest.clearAllMocks();
});

class Tester extends OpenSearchFileIngestorDirect {
  testIt(contents: string, trace?: boolean): string {
    return this.cleanUpContents(contents, console.log, trace);
  }
}
const config = {} as OpenSearchFileIngestorDirectConfig;
const tester = new Tester(config);

/**
 * If you want to debug a specific case, pass `true` as second param of `tester.testIt()`
 */
describe("cleanUpContents", () => {
  let fileContents: string | undefined = undefined;
  let res: string;
  beforeAll(() => {
    fileContents = fs.readFileSync(fileName, { encoding: "utf8" });
    res = tester.testIt(fileContents);
    fs.writeFileSync(fileName + ".cleaned", res);
  });

  // All strings to be checked must be lowercase
  // Space before and after the string to avoid false positives
  /**
   * Checks whether the string contains a given string, case insensitive.
   * It won't match intermediate words, only whole words - although a word can contain
   * spaces.
   * Example: res = "foo bar baz"
   * Matches: "foo", "foo bar", "foo bar baz", "bar baz"
   * Doesnt matche: "oo", "o bar", "r baz", "ba", "ar"
   */
  const contains = (str: string) => expect(res).toContain(` ${str.toLowerCase()} `);
  const notContains = (str: string) => expect(res).not.toContain(` ${str.toLowerCase()} `);

  test.todo("removes markup stuff");

  it("keeps id", async () => contains("99b52511-f876-926f-f08e-4a898d6771f9"));

  it("keeps value", async () => {
    // <value xsi:type="CD" code="224299000" codeSystem="2.16.840.1.113883.6.96" displayName="Received higher education (finding)">
    contains("CD"); // xsi:type
    contains("224299000"); // code
    contains("2.16.840.1.113883.6.96"); // codeSystem
    contains("Received higher education (finding)"); // displayName
  });

  it("keeps time", async () => contains("20230616065810"));

  it("keeps title", async () => contains("Vital Signs"));

  it("keeps single quotes", async () => contains("document's"));

  it("keeps text", async () => {
    contains("There are no current vital signs at the time of this document's creation.");
  });

  it("keeps code", async () => {
    contains("47519-4"); // code
    contains("2.16.840.1.113883.6.1"); // codeSystem
    contains("LOINC"); // codeSystemName
    contains("procedures"); // display name
  });

  it("keeps annual physical exam", async () => {
    contains("Z00.00"); // code
    contains("2.16.840.1.113883.6.90"); // codeSystem
    contains("ICD10"); // codeSystemName
    contains("Annual physical exam"); // display name
  });

  it("keeps translation", async () => {
    contains("75323-6"); // code
    contains("Condition"); // displayName
    contains("2.16.840.1.113883.6.1"); // codeSystem
    contains("LOINC"); // codeSystemName
  });

  it("keeps author", async () => {
    contains("4fd5s4f5as4f5dsa4f6s5a4fsd4f6a4d64sa56"); // id
    contains("NORTON HEALTH CARE PC 123456"); // org's name
    contains("xuxu on steroids"); // org's name attrib
    contains("789785 E MAIN ST STE A"); // address line
    contains("027812307"); // zip
  });

  it("keeps participant", async () => {
    contains("MANU"); // participant role
    contains("MMAT"); // participant entity
  });

  it("keeps html content", async () => {
    contains("Encounters"); // title
    contains("Start"); // th
    contains("2011-09-30T06:58:10-07:00"); // tr.td
    contains("Medication review due (situation)");
    contains("314529007");
    contains("http://snomed.info/sct");
  });

  test("detailed removing city", async () => {
    const text = `<city>NORTON</city>`;
    const res = tester.testIt(text);
    expect(res).not.toContain("city");
    expect(res).toContain(" norton");
  });

  it("removes html tags in detail", async () => {
    const text = `<td ID="encounters-code-1">http://snomed.info/sct 702927004</td>`;
    const res = tester.testIt(text);
    expect(res).not.toContain("<td");
    expect(res).not.toContain("encounters-code-1");
    expect(res).toContain(" http://snomed.info/sct");
    expect(res).toContain(" 702927004");
  });

  it("does not keep html tags", async () => {
    notContains("encounters-desc-1123456"); // attribute
    notContains("<table");
    notContains("thead");
    notContains("tbody");
    notContains("<tr");
    notContains("<td");
  });
});

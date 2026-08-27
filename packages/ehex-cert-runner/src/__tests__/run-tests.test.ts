import { parseAndValidateSamlSignature } from "@metriport/core/external/ehex/ehex-gateway/inbound/shared";
import { isZodError } from "@metriport/shared/util/zod";
import { iti55RequestSchema } from "@metriport/core/external/ehex/ehex-gateway/inbound/xcpd/process/schema";
import * as validateModule from "@metriport/core/external/ehex/ehex-gateway/saml/security/validate";
import { createXMLParser } from "@metriport/shared/common/xml-parser";
import fs from "fs";
import { isEqual } from "lodash";
import path from "path";
import { iti39RequestSchema } from "@metriport/core/external/ehex/ehex-gateway/inbound/xca/process/schema";

const validateDigestValuesMock = jest.spyOn(validateModule, "validateDigestValues");

beforeEach(() => {
  jest.resetAllMocks();
});

const parser = createXMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "_",
  textNodeName: "_text",
  parseAttributeValue: false,
  removeNSPrefix: true,
});

function confirmErrorScenario(
  error: unknown,
  expectedPath: string[],
  expectedType: string,
  expectedValue: string
): boolean {
  if (isZodError(error)) {
    const issues = error.issues;
    const matchingIssue = issues.find(issue => {
      const issuePath = issue.path.map(String);
      return (
        isEqual(issuePath, expectedPath) &&
        "expected" in issue &&
        "received" in issue &&
        issue.expected === expectedType &&
        issue.received === expectedValue
      );
    });
    return matchingIssue !== undefined;
  }
  return false;
}

describe.skip("eHex Certification Tests", () => {
  it("should fail on 000.xml - Handle missing wsse:Security element", () => {
    const filePath = path.resolve(__dirname, "test-cases/000.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 101.xml - Handle missing Security/Timestamp element", () => {
    const filePath = path.resolve(__dirname, "test-cases/101.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Timestamp"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 301.xml - Handle missing Assertion signature element", () => {
    const filePath = path.resolve(__dirname, "test-cases/301.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Assertion", "Signature"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 302.xml - Handle invalid Assertion signature", () => {
    const filePath = path.resolve(__dirname, "test-cases/302.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      validateDigestValuesMock.mockImplementation(() => {
        // Do nothing to prevent the digest value from coming up first and failing the test
        return Promise.resolve();
      });
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.message.startsWith("SAML signature verification failed")) {
        errorConfirmed = true;
      }
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 303.xml - Handle missing Timestamp signature element", () => {
    const filePath = path.resolve(__dirname, "test-cases/303.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Signature"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 306.xml - Handle missing CanonicalizationMethod element in Timestamp signature", () => {
    const filePath = path.resolve(__dirname, "test-cases/306.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Signature", "SignedInfo", "CanonicalizationMethod"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 307.xml - Handle missing CanonicalizationMethod algorithm in Timestamp signature", () => {
    const filePath = path.resolve(__dirname, "test-cases/307.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Signature", "SignedInfo", "CanonicalizationMethod"],
        "object",
        "string"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 308.xml - Handle missing SignatureMethod element in Timestamp signature", () => {
    const filePath = path.resolve(__dirname, "test-cases/308.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Signature", "SignedInfo", "SignatureMethod"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 315.xml - Handle missing DigestValue element in Timestamp signature reference", () => {
    const filePath = path.resolve(__dirname, "test-cases/315.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Signature", "SignedInfo", "Reference", "DigestValue"],
        "string",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 316.xml - Handle Invalid DigestValue in Timestamp signature reference", () => {
    const filePath = path.resolve(__dirname, "test-cases/316.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.message.startsWith("Digest mismatch")) {
        errorConfirmed = true;
      }
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 317.xml - Handle missing SignatureValue element in Timestamp signature", () => {
    const filePath = path.resolve(__dirname, "test-cases/317.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Signature", "SignatureValue"],
        "string",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 325.xml - Handle Invalid KeyIdentifier (AssertionID) in timestamp signature", () => {
    const filePath = path.resolve(__dirname, "test-cases/325.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
      if (error.message.startsWith("Invalid KeyIdentifier value")) {
        errorConfirmed = true;
      }
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 326.xml - Handle Missing KeyInfo in Assertion signature", () => {
    const filePath = path.resolve(__dirname, "test-cases/326.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Assertion", "Signature", "KeyInfo"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 401.xml - Handle missing Assertion element", () => {
    const filePath = path.resolve(__dirname, "test-cases/401.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Assertion"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 421.xml - Handle Missing Subject Name ID in Assertion", () => {
    const filePath = path.resolve(__dirname, "test-cases/421.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      iti55RequestSchema.parse(jsonObj);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Assertion", "Subject", "NameID"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 423.xml - Handle Missing Subject Confirmation in Assertion", () => {
    const filePath = path.resolve(__dirname, "test-cases/423.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      validateDigestValuesMock.mockImplementation(() => {
        // Do nothing to prevent the digest value from coming up first and failing the test
        return Promise.resolve();
      });
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        ["Envelope", "Header", "Security", "Assertion", "Subject", "SubjectConfirmation"],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 424.xml - Handle Missing Subject Confirmation Method in Assertion", () => {
    const filePath = path.resolve(__dirname, "test-cases/424.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        [
          "Envelope",
          "Header",
          "Security",
          "Assertion",
          "Subject",
          "SubjectConfirmation",
          "_Method",
        ],
        "string",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 426.xml - Handle Missing Subject Confirmation Data in Assertion", () => {
    const filePath = path.resolve(__dirname, "test-cases/426.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        [
          "Envelope",
          "Header",
          "Security",
          "Assertion",
          "Subject",
          "SubjectConfirmation",
          "SubjectConfirmationData",
        ],
        "object",
        "undefined"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on 427.xml - Handle Missing Subject Confirmation Key Info in Assertion", () => {
    const filePath = path.resolve(__dirname, "test-cases/427.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    let errorConfirmed = false;
    try {
      const itiRequest = iti55RequestSchema.parse(jsonObj);
      parseAndValidateSamlSignature(fileContent, itiRequest);
    } catch (error) {
      errorConfirmed = confirmErrorScenario(
        error,
        [
          "Envelope",
          "Header",
          "Security",
          "Assertion",
          "Subject",
          "SubjectConfirmation",
          "SubjectConfirmationData",
        ],
        "object",
        "string"
      );
    }
    expect(errorConfirmed).toBe(true);
  });

  it("should fail on dr.xml - Handle Missing Subject Confirmation Key Info in Assertion", () => {
    const filePath = path.resolve(__dirname, "test-cases/dr.xml");
    const fileContent = fs.readFileSync(filePath, "utf8");
    const jsonObj = parser.parse(fileContent);

    const itiRequest = iti39RequestSchema.parse(jsonObj);
    console.log("ITI REQUEST: ", itiRequest);
    parseAndValidateSamlSignature(fileContent, itiRequest);
  });
});

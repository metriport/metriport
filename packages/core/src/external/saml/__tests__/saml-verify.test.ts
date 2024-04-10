import { verifySaml } from "../security/verify";
import fs from "fs";
import path from "path";
import { TEST_CERT } from "./constants";

const xmlString = fs.readFileSync(path.join(__dirname, "./valid-saml.xml"), "utf8");
describe("SAML Verification Edge Cases", () => {
  it("should return true when verifying SAML signature with valid public key in XML", () => {
    const publicCert = TEST_CERT;

    const result = verifySaml({ xmlString, publicCert });

    expect(result).toBe(true);
  });
  it("should return false when verifying SAML signature with invalid public key in XML", () => {
    const publicCert = "invalid cert";

    const result = verifySaml({ xmlString, publicCert });

    expect(result).toBe(false);
  });

  it("should return false when verifying SAML signature with invalid XML", () => {
    const invalidXmlString = "invalid xml";

    const result = verifySaml({ xmlString: invalidXmlString, publicCert: TEST_CERT });

    expect(result).toBe(false);
  });
  it("should return false when verifying SAML signature with empty xml", () => {
    const emptyXmlString = "";

    const result = verifySaml({ xmlString: emptyXmlString, publicCert: TEST_CERT });

    expect(result).toBe(false);
  });
});

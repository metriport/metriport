import fs from "fs";
import path from "path";
//import { v4 as uuidv4 } from "uuid";
import { processDRResponse } from "../xca/process/dr-response";
import { outboundDRRequestMTOM, outboundDRRequestMultiMTOM } from "./constants";
import { S3Utils } from "../../../../aws/s3";
import { Config } from "../../../../../util/config";

const s3Utils = new S3Utils(Config.getAWSRegion());

describe("processDRResponse", () => {
  beforeEach(() => {
    jest.spyOn(S3Utils.prototype, "uploadFile").mockImplementation(() =>
      Promise.resolve({
        Location: "http://example.com/mockurl",
        ETag: '"mockedetag"',
        Bucket: "mockedbucket",
        Key: "mockedkey",
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.skip("should process mtom response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/mtom-binary-xml.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start="<http://tempuri.org/0>";boundary="uuid:5ef8425b-44e7-4a4c-8144-b8ddacb300f9+id=186535";start-info="application/soap+xml`;
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequestMTOM.gateway,
        outboundRequest: outboundDRRequestMTOM,
        contentType,
      },
      s3Utils,
    });
    expect(response.documentReference?.length).toBe(1);
    expect(response.documentReference?.[0]?.contentType).toBe("application/xml");
  });
  it.skip("should process other mtom response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/mtom-xml.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start="<0.urn:uuid:2a28fe28-cd7d-44f9-88dd-0ab2a2d80073>";boundary="a1109b32-0907-4c3c-9d61-8b8d846b9983";start-info="application/soap+xml`;
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequestMTOM.gateway,
        outboundRequest: outboundDRRequestMTOM,
        contentType,
      },
      s3Utils,
    });
    expect(response.documentReference?.length).toBe(1);
    expect(response.documentReference?.[0]?.contentType).toBe("application/xml");
  });
  it.skip("should process multiple files in mtom response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/multi-mtom.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start=""<http://tempuri.org/0>";boundary="uuid:34605f3a-f898-4d62-99a5-c0fc113a7e59+id=51889";start-info="application/soap+xml`;
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequestMTOM.gateway,
        outboundRequest: outboundDRRequestMultiMTOM,
        contentType,
      },
      s3Utils,
    });
    expect(response.documentReference?.length).toBe(2);
  });
  it("should not process non-xml mtom response", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/mtom-non-xml.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start="<0.urn:uuid:2a28fe28-cd7d-44f9-88dd-0ab2a2d80073>";boundary="a1109b32-0907-4c3c-9d61-8b8d846b9983";start-info="application/soap+xml`;
    const response = await processDRResponse({
      drResponse: {
        success: true,
        response: xmlString,
        gateway: outboundDRRequestMTOM.gateway,
        outboundRequest: outboundDRRequestMultiMTOM,
        contentType,
      },
      s3Utils,
    });
    expect(response.documentReference?.length).toBe(0);
  });
});

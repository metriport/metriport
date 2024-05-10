import fs from "fs";
import path from "path";
//import { v4 as uuidv4 } from "uuid";
import { processDRResponse } from "../xca/process/dr-response";
import { outboundDRRequestMTOM } from "./constants";
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

  it("should process multiple DR responses correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "files/mtom.txt"), "utf8");
    const contentType = `multipart/related; type="application/xop+xml";start="<http://tempuri.org/0>";boundary="uuid:5ef8425b-44e7-4a4c-8144-b8ddacb300f9+id=186535";start-info="application/soap+xml`;
    console.log(xmlString);
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
});

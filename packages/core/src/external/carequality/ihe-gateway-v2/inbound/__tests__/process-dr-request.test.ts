import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { InboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { createITI39SoapEnvelope } from "../../outbound/xca/create/iti39-envelope";
import { iti39BodyData } from "../../saml/__tests__/constants";
import { TEST_CERT, TEST_KEY, xcaGateway } from "../../saml/__tests__/constants";
import { signTimestamp } from "../../saml/security/sign";
import { processInboundDrRequest } from "../xca/process-dr";
import { createIti39SoapEnvelopeInboundResponse } from "../xca/create-dr-resp";
import { processDrResponse } from "../../outbound/xca/process/dr-response";
import { convertSoapResponseToMtomResponse } from "../../outbound/xca/mtom/parser";
import { S3Utils } from "../../../../aws/s3";

it("should process ITI-39 request", () => {
  try {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: iti39BodyData,
      publicCert: TEST_CERT,
    });
    const signedEnvelope = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
    const iti39Request = processInboundDrRequest(signedEnvelope);

    const expectedDocumentReference = iti39BodyData.documentReference.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ metriportId, ...rest }) => rest
    );
    const actualDocumentReference = iti39Request.documentReference.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ({ metriportId, ...rest }) => rest
    );

    expect(actualDocumentReference).toEqual(expectedDocumentReference);
  } catch (error) {
    console.log(error);
    expect(true).toBe(false);
  }
});
describe("should process ITI-39 response", () => {
  beforeEach(() => {
    jest.spyOn(S3Utils.prototype, "uploadFile").mockImplementation(() => {
      return Promise.resolve({
        Location: "http://example.com/mockurl",
        ETag: '"mockedetag"',
        Bucket: "mockedbucket",
        Key: "mockedkey",
      });
    });

    jest.spyOn(S3Utils.prototype, "getFileInfoFromS3").mockImplementation(() =>
      Promise.resolve({
        exists: false,
      })
    );
    jest.spyOn(S3Utils.prototype, "downloadFile").mockImplementation(() => {
      const filePath = path.join(__dirname, "./files/", "test.pdf");
      const fileBuffer = fs.readFileSync(filePath);
      return Promise.resolve(fileBuffer);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
  it("normal iti39", async () => {
    const response: InboundDocumentRetrievalResp = {
      ...iti39BodyData,
      documentReference: iti39BodyData.documentReference.map(docRef => ({
        ...docRef,
        urn: uuidv4(),
        contentType: "application/pdf",
      })),
      responseTimestamp: new Date().toISOString(),
    };

    const xmlResponse = await createIti39SoapEnvelopeInboundResponse(response);
    const mtomResponse = convertSoapResponseToMtomResponse(Buffer.from(xmlResponse));
    const iti39Response = await processDrResponse({
      response: {
        outboundRequest: {
          ...iti39BodyData,
          documentReference: iti39BodyData.documentReference.map(docRef => ({
            ...docRef,
            metriportId: uuidv4(),
          })),
        },
        mtomResponse,
        gateway: xcaGateway,
      },
    });
    if (
      iti39Response.documentReference &&
      iti39Response.documentReference[0] &&
      response.documentReference &&
      response.documentReference[0]
    ) {
      expect(iti39Response.documentReference[0].docUniqueId).toEqual(
        response.documentReference[0].docUniqueId
      );
      expect(iti39Response.documentReference[0].contentType).toEqual(
        response.documentReference[0].contentType
      );
    } else {
      throw new Error(
        "iti98Response.documentReference is undefined or has wrong document unique id"
      );
    }
  });
});

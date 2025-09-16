import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { InboundDocumentRetrievalResp } from "@metriport/ihe-gateway-sdk";
import { createITI39SoapEnvelope } from "../../outbound/xca/create/iti39-envelope";
import {
  TEST_CERT,
  TEST_KEY,
  xcaGateway,
  outboundDrRequest,
} from "../../outbound/__tests__/constants";
import { signTimestamp } from "../../saml/security/sign";
import { processInboundDrRequest } from "../xca/process/dr-request";
import { createInboundDrResponse } from "../xca/create/dr-response";
import { processDrResponse } from "../../outbound/xca/process/dr-response";
import { convertSoapResponseToMtomResponse } from "../../outbound/xca/mtom/parser";
import { S3Utils } from "../../../../aws/s3";

describe("Process Inbound Dr Request", () => {
  beforeEach(() => {
    jest.spyOn(S3Utils.prototype, "uploadFile").mockImplementation(() => {
      return Promise.resolve({
        location: "http://example.com/mockurl",
        eTag: '"mockedetag"',
        bucket: "mockedbucket",
        key: "mockedkey",
        versionId: "mockVersionId",
      });
    });
  });
  it("should process ITI-39 request", async () => {
    try {
      const soapEnvelope = createITI39SoapEnvelope({
        bodyData: outboundDrRequest,
        publicCert: TEST_CERT,
      });
      const signedEnvelope = signTimestamp({ xml: soapEnvelope, privateKey: TEST_KEY });
      const iti39Request = await processInboundDrRequest(signedEnvelope);

      const expectedDocumentReference = outboundDrRequest.documentReference.map(
        ({ docUniqueId, homeCommunityId, repositoryUniqueId }) => ({
          docUniqueId,
          homeCommunityId,
          repositoryUniqueId,
        })
      );
      const actualDocumentReference = iti39Request.documentReference.map(
        ({ docUniqueId, homeCommunityId, repositoryUniqueId }) => ({
          docUniqueId,
          homeCommunityId,
          repositoryUniqueId,
        })
      );

      expect(actualDocumentReference).toEqual(expectedDocumentReference);
    } catch (error) {
      expect(true).toBe(false);
    }
  });
  it("should process invalid ITI-39 request correctly", async () => {
    const soapEnvelope = createITI39SoapEnvelope({
      bodyData: outboundDrRequest,
      publicCert: TEST_CERT,
    });
    await expect(processInboundDrRequest(soapEnvelope)).rejects.toThrow(
      "Failed to parse ITI-39 request"
    );
  });
});

describe("Process Inbound Dr Response", () => {
  beforeEach(() => {
    jest.spyOn(S3Utils.prototype, "uploadFile").mockImplementation(() => {
      return Promise.resolve({
        location: "http://example.com/mockurl",
        eTag: '"mockedetag"',
        bucket: "mockedbucket",
        key: "mockedkey",
        versionId: "mockVersionId",
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
  it("should process successful Iti-39 Response", async () => {
    const response: InboundDocumentRetrievalResp = {
      ...outboundDrRequest,
      documentReference: outboundDrRequest.documentReference.map(docRef => ({
        ...docRef,
        urn: uuidv4(),
        contentType: "application/pdf",
      })),
      responseTimestamp: new Date().toISOString(),
    };

    const xmlResponse = await createInboundDrResponse(response);
    const mtomResponse = convertSoapResponseToMtomResponse(Buffer.from(xmlResponse));
    const iti39Response = await processDrResponse({
      response: {
        outboundRequest: {
          ...outboundDrRequest,
          documentReference: outboundDrRequest.documentReference.map(docRef => ({
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
  it("should process ITI-38 error response", async () => {
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { documentReference, ...outboundDrRequestWithoutDocRef } = outboundDrRequest;
    const response = {
      ...outboundDrRequestWithoutDocRef,
      responseTimestamp: new Date().toISOString(),
      externalGatewayPatient: {
        id: "123456789",
        system: "987654321",
      },
      gatewayHomeCommunityId: "123456789",
      operationOutcome: {
        resourceType: "OperationOutcome",
        id: outboundDrRequest.id,
        issue: [
          {
            severity: "error",
            code: "XDSRegistryError",
            details: {
              coding: [{ system: "1.3.6.1.4.1.19376.1.2.27.1", code: "XDSRegistryError" }],
              text: "Internal Server Error",
            },
          },
        ],
      },
    };

    const xmlResponse = await createInboundDrResponse(response);
    const mtomResponse = convertSoapResponseToMtomResponse(Buffer.from(xmlResponse));
    const iti39Response = await processDrResponse({
      response: {
        outboundRequest: {
          ...outboundDrRequest,
          documentReference: outboundDrRequest.documentReference.map(docRef => ({
            ...docRef,
            metriportId: uuidv4(),
          })),
        },
        mtomResponse,
        gateway: xcaGateway,
      },
    });
    expect(iti39Response.operationOutcome).toEqual(response.operationOutcome);
  });
});

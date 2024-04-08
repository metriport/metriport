import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { processXCPDResponse } from "../process-xcpd-response";
import {
  outboundPatientDiscoveryRespSuccessfulSchema,
  outboundPatientDiscoveryRespFaultSchema,
} from "@metriport/ihe-gateway-sdk";

const outboundRequest = {
  id: uuidv4(),
  cxId: uuidv4(),
  patientId: uuidv4(),
  timestamp: "2024-04-04T19:11:55.879Z",
  principalCareProviderIds: ["1234567890"],
  samlAttributes: {
    subjectId: "America Inc",
    subjectRole: {
      code: "106331006",
      display: "Administrative AND/OR managerial worker",
    },
    organization: "White House Medical Inc",
    organizationId: "2.16.840.1.113883.3.9621.5.213",
    homeCommunityId: "2.16.840.1.113883.3.9621.5.213",
    purposeOfUse: "TREATMENT",
  },
  patientResource: {
    name: [
      {
        given: ["NWHINONE"],
        family: "NWHINZZZTESTPATIENT",
      },
    ],
    gender: "male",
    birthDate: "19810101",
    address: [
      {
        line: ["1100 Test Street"],
        city: "Helena",
        state: "Helena",
        postalCode: "Helena",
        country: "Helena",
      },
    ],
  },
  gateways: [
    {
      url: "https://mock-metriport/soap/iti55",
      oid: "2.16.840.1.113883.3.787.0.0",
      id: "018ea97e-7b1c-78e9-8aa1-47c7caf85afe",
    },
  ],
};

if (!outboundRequest.gateways[0]) {
  throw new Error("Gateway must be provided");
}
const gateway = {
  url: outboundRequest.gateways[0].url,
  oid: outboundRequest.gateways[0].oid,
  id: outboundRequest.gateways[0].id,
};

describe("processXCPDResponse", () => {
  it("should process the match XCPD response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xcpd_match.xml"), "utf8");

    const response = processXCPDResponse({
      xmlStringOrError: xmlString,
      outboundRequest,
      gateway,
    });

    const expectedResponse = {
      externalGatewayPatient: {
        id: "ODFmMmVjNGUtYzcxYy00MDkwLWJmMWMtOWQ4NTI5ZjY1YjVhLzAxOGUxMDU4LTllMWEtN2MzMy1hMmRkLTVhNzg4NGU2ZmMzOA==",
        system: "2.16.840.1.113883.3.9621",
      },
      patientMatch: true,
      patientResource: {
        name: [
          {
            given: ["NWHINONE"],
            family: "NWHINZZZTESTPATIENT",
          },
        ],
        gender: "male",
        birthDate: "19810101",
        address: [
          {
            line: ["1100 Test Street"],
            city: "Helena",
            state: "Helena",
            postalCode: "Helena",
            country: "Helena",
          },
        ],
      },
    };

    const xcpdResult = outboundPatientDiscoveryRespSuccessfulSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    if (xcpdResult.success) {
      expect(xcpdResult.data.externalGatewayPatient?.id).toEqual(
        expectedResponse?.externalGatewayPatient?.id
      );
      expect(xcpdResult.data.externalGatewayPatient?.system).toEqual(
        expectedResponse?.externalGatewayPatient?.system
      );
      expect(xcpdResult.data.patientMatch).toBe(expectedResponse?.patientMatch);
      expect(xcpdResult.data.patientResource).toEqual(expectedResponse?.patientResource);
    }
  });
  it("should correctly identify and process a no match XCPD response", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xcpd_no_match.xml"), "utf8");
    const response = processXCPDResponse({
      xmlStringOrError: xmlString,
      outboundRequest,
      gateway,
    });
    const xcpdResult = outboundPatientDiscoveryRespFaultSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    expect(xcpdResult.data.patientMatch).toBeFalsy();
  });
  it("should process the error XCPD response correctly", async () => {
    const xmlString = fs.readFileSync(path.join(__dirname, "xcpd_error.xml"), "utf8");

    const response = processXCPDResponse({
      xmlStringOrError: xmlString,
      outboundRequest,
      gateway,
    });
    const xcpdResult = outboundPatientDiscoveryRespFaultSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    expect(xcpdResult.data.patientMatch).toBeNull();
  });
  it("should process the HTTP error XCPD response correctly", async () => {
    const httpError = { error: "HTTP 503 error" };

    const response = processXCPDResponse({
      xmlStringOrError: httpError,
      outboundRequest,
      gateway,
    });
    const xcpdResult = outboundPatientDiscoveryRespFaultSchema.safeParse(response);
    if (!xcpdResult.success) {
      throw new Error("Failed to parse response");
    }
    console.log(JSON.stringify(xcpdResult.data, null, 2));
    expect(xcpdResult.data.operationOutcome).toBeDefined();
    expect(xcpdResult.data.patientMatch).toBeNull();
  });
});

import { XMLParser } from "fast-xml-parser";
import {
  OutboundPatientDiscoveryResp,
  OutboundPatientDiscoveryReq,
  XCPDGateway,
  OperationOutcome,
} from "@metriport/ihe-gateway-sdk";
import { normalizeGender } from "./utils";

export function processXCPDResponse({
  xmlString,
  outboundRequest,
  gateway,
}: {
  xmlString: string;
  outboundRequest: OutboundPatientDiscoveryReq;
  gateway: XCPDGateway;
}): OutboundPatientDiscoveryResp {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    parseAttributeValue: false,
  });

  const jsonObj = parser.parse(xmlString);

  const ack =
    jsonObj["soap:Envelope"]["soap:Body"]["PRPA_IN201306UV02"]["acknowledgement"]["typeCode"][
      "@_code"
    ];
  const queryResponseCode =
    jsonObj["soap:Envelope"]["soap:Body"]["PRPA_IN201306UV02"]["controlActProcess"]["queryAck"][
      "queryResponseCode"
    ]["@_code"];

  if (ack === "AA" && queryResponseCode === "OK") {
    const subject1 =
      jsonObj["soap:Envelope"]["soap:Body"]["PRPA_IN201306UV02"]["controlActProcess"]["subject"][
        "registrationEvent"
      ]["subject1"];

    const addr = subject1["patient"]["patientPerson"]["addr"];
    const addresses = [
      {
        line: [addr["streetAddressLine"]["#text"] || addr["streetAddressLine"]],
        city: addr["city"]["#text"] || addr["city"],
        state: addr["state"]["#text"] || addr["state"],
        postalCode: addr["postalCode"]["#text"] || addr["postalCode"],
        country: addr["country"]["#text"] || addr["country"],
      },
    ];

    const patientResource = {
      name: [
        {
          given: [subject1["patient"]["patientPerson"]["name"]["given"]],
          family: subject1["patient"]["patientPerson"]["name"]["family"],
        },
      ],
      gender: normalizeGender(
        subject1["patient"]["patientPerson"]["administrativeGenderCode"]["@_code"]
      ),
      birthDate: subject1["patient"]["patientPerson"]["birthTime"]["@_value"],
      address: addresses,
    };

    const response: OutboundPatientDiscoveryResp = {
      id: outboundRequest.id,
      timestamp: outboundRequest.timestamp,
      responseTimestamp: new Date().toISOString(),
      externalGatewayPatient: {
        id: subject1["patient"]["id"]["@_extension"].toString(),
        system: subject1["patient"]["id"]["@_root"].toString(),
      },
      gateway: gateway,
      patientId: outboundRequest.patientId,
      patientMatch: true,
      gatewayHomeCommunityId: outboundRequest.samlAttributes.homeCommunityId,
      patientResource: patientResource,
    };

    return response;
  } else {
    const operationOutcome: OperationOutcome = {
      resourceType: "OperationOutcome",
      id: outboundRequest.id,
      issue: [],
    };
    if (ack === "AE" || queryResponseCode === "AE") {
      try {
        const acknowledgementDetail =
          jsonObj["soap:Envelope"]["soap:Body"]["PRPA_IN201306UV02"]["acknowledgement"][
            "acknowledgementDetail"
          ];
        const issue = {
          severity: "error",
          code: acknowledgementDetail["code"]["@_code"],
          details: {
            text: acknowledgementDetail["text"]["#text"] || acknowledgementDetail["text"],
          },
        };
        operationOutcome.issue.push(issue);
      } catch (error) {
        // Handle error if acknowledgementDetail is not found
      }
      const response: OutboundPatientDiscoveryResp = {
        id: outboundRequest.id,
        timestamp: outboundRequest.timestamp,
        responseTimestamp: new Date().toISOString(),
        gateway: gateway,
        patientId: outboundRequest.patientId || "",
        patientMatch: null,
        operationOutcome: operationOutcome,
      };
      return response;
    } else {
      const issue = {
        severity: "information",
        code: "not-found",
        details: {
          text: "NF",
        },
      };
      operationOutcome.issue.push(issue);
      const response: OutboundPatientDiscoveryResp = {
        id: outboundRequest.id,
        timestamp: outboundRequest.timestamp,
        responseTimestamp: new Date().toISOString(),
        gateway: gateway,
        patientId: outboundRequest.patientId || "",
        patientMatch: false,
        operationOutcome: operationOutcome,
      };
      return response;
    }
  }
}

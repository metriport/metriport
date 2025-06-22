import { Endpoint } from "@medplum/fhirtypes";
import { OrganizationWithId } from "@metriport/carequality-sdk/client/carequality";
import {
  ChannelUrl,
  XCA_DQ_STRING,
  XCA_DR_STRING,
  XCPD_STRING,
} from "@metriport/carequality-sdk/common/util";
import { normalizeState } from "@metriport/shared/domain/address/state";
import { CQOrgDetailsWithUrls } from "../../shared";
import { metriportOid } from "./constants";

export const transactionUrl =
  "https://sequoiaproject.org/fhir/sphd/StructureDefinition/Transaction";

export function getOrganizationFhirTemplate(orgDetails: CQOrgDetailsWithUrls): OrganizationWithId {
  const { oid, role, urlXCPD, urlDQ, urlDR } = orgDetails;
  const urnOid = "urn:oid:" + oid;
  const endpoints: Endpoint[] = [];
  if (role === "Implementer") {
    if (!urlXCPD) throw new Error("XCPD URL is required for Implementer role");
    endpoints.push(getFhirEndpoint(urnOid, XCPD_STRING, urlXCPD));
    if (!urlDQ) throw new Error("DQ URL is required for Implementer role");
    endpoints.push(getFhirEndpoint(urnOid, XCA_DQ_STRING, urlDQ));
    if (!urlDR) throw new Error("DR URL is required for Implementer role");
    endpoints.push(getFhirEndpoint(urnOid, XCA_DR_STRING, urlDR));
  }
  const org = getFhirOrganization(urnOid, orgDetails, endpoints);
  return org;
}

function getFhirOrganization(
  urnOid: string,
  orgDetails: CQOrgDetailsWithUrls,
  endpoints: Endpoint[]
): OrganizationWithId {
  const {
    oid,
    active,
    name,
    role,
    contactName,
    phone,
    email,
    addressLine1,
    city,
    state: stateRaw,
    postalCode,
    lat,
    lon,
    parentOrgOid,
    oboOid,
    oboName,
  } = orgDetails;

  const state = normalizeState(stateRaw);
  const addressText = `${addressLine1} ${city} ${state} ${postalCode} US`;
  const org: OrganizationWithId = {
    resourceType: "Organization",
    id: oid,
    identifier: [
      {
        type: {
          coding: [
            {
              system: "https://sequoiaproject.org/fhir/sphd/CodeSystem/SequoiaIdentifierCodes",
              code: "HCID",
            },
          ],
        },
        system: "urn:ietf:rfc:3986",
        value: urnOid,
        use: "official",
      },
    ],
    active,
    name,
    type: [
      {
        coding: [
          {
            system: "https://sequoiaproject.org/fhir/sphd/CodeSystem/OrganizationType",
            code: role,
          },
        ],
      },
    ],
    contact: [
      {
        purpose: {
          text: "Operations",
        },
        name: {
          use: "official",
          text: contactName,
        },
        telecom: [
          {
            system: "email",
            value: email,
            use: "work",
          },
          {
            system: "phone",
            value: phone,
            use: "work",
          },
        ],
        address: {
          use: "work",
          type: "both",
          line: [addressLine1],
          city,
          state,
          postalCode,
          country: "US",
        },
      },
    ],
    extension: [
      {
        url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/Domains",
        valueCoding: {
          system: "https://sequoiaproject.org/fhir/sphd/CodeSystem/Domains",
          code: "CQ",
        },
      },
      ...(oboOid
        ? [
            {
              url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/DOA",
              valueReference: {
                reference: `Organization/${oboOid}`,
              },
            },
          ]
        : []),
      {
        url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/org-managing-org",
        valueReference: {
          reference: `Organization/${metriportOid}`,
        },
      },
    ],
    address: [
      {
        text: addressText,
        line: [addressLine1],
        city,
        state,
        postalCode,
        country: "US",
        extension: [
          {
            url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/OrgLocation",
            valueReference: {
              reference: "#OrgLoc",
            },
          },
        ],
      },
    ],
    partOf: {
      reference: `Organization/${parentOrgOid ?? metriportOid}`,
    },
    ...(endpoints.length > 0
      ? {
          endpoint: endpoints.map((_, index) => {
            return {
              reference: `#endpoint-${index + 1}`,
              type: "Endpoint",
            };
          }),
        }
      : {}),
    contained: [
      {
        id: "OrgLoc",
        resourceType: "Location",
        meta: {
          profile: ["https://sequoiaproject.org/fhir/sphd/StructureDefinition/SequoiaLocation"],
        },
        position: {
          longitude: parseFloat(lon),
          latitude: parseFloat(lat),
        },
      },
      ...endpoints.map((endpoint, index) => {
        return {
          ...endpoint,
          id: `endpoint-${index + 1}`,
        };
      }),
    ],
    text: {
      div: `<div xmlns="http://www.w3.org/1999/xhtml">${oboName ?? name}</div>`,
      status: "generated",
    },
  };
  return org;
}

function getFhirEndpoint(urnOid: string, urlType: ChannelUrl, url: string): Endpoint {
  const channelType = urlType === XCPD_STRING ? "ihe-xcpd" : "ihe-xca";
  const channelName =
    urlType === XCPD_STRING
      ? "Patient Discovery"
      : urlType === XCA_DQ_STRING
      ? "Query for Documents"
      : "Retrieve Documents";
  return {
    resourceType: "Endpoint",
    identifier: [
      {
        use: "official",
        type: {
          coding: [
            {
              system: "https://sequoiaproject.org/fhir/sphd/CodeSystem/SequoiaIdentifierCodes",
              code: "HCID",
            },
          ],
        },
        system: "http://www.hl7.org/oid/",
        value: urnOid,
      },
      {
        use: "official",
        type: {
          coding: [
            {
              system: "https://sequoiaproject.org/fhir/sphd/CodeSystem/SequoiaIdentifierCodes",
              code: "AAID",
            },
          ],
        },
        system: "http://www.hl7.org/oid/",
      },
    ],
    connectionType: {
      system: "http://terminology.hl7.org/CodeSystem/endpoint-connection-type",
      code: channelType,
    },
    name: channelName,
    address: url,
    payloadMimeType: ["application/json"],
    payloadType: [
      {
        coding: [
          {
            system: "urn:oid:1.3.6.1.4.1.19376.1.2.3",
          },
        ],
      },
    ],
    extension: [
      {
        url: transactionUrl,
        valueCodeableConcept: {
          coding: [
            {
              system: "https://sequoiaproject.org/fhir/sphd/CodeSystem/TransactionCodes",
              code: urlType,
            },
          ],
        },
      },
      {
        url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/Version",
        valueString: "2.0",
      },
      {
        url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/PurposesOfUse",
        valueCodeableConcept: {
          coding: [
            {
              system: "http://healthit.gov/nhin/purposeofuse",
              code: "TREATMENT",
            },
          ],
        },
      },
      {
        url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/Roles",
        valueCodeableConcept: {
          coding: [
            {
              system: "https://sequoiaproject.org/fhir/sphd/CodeSystem/EndpointRoleCodes",
              code: "All",
            },
          ],
        },
      },
    ],
    managingOrganization: {
      reference: `Organization/${metriportOid}`,
      type: "Organization",
    },
  };
}

import {
  ChannelUrl,
  XCA_DQ_STRING,
  XCA_DR_STRING,
  XCPD_STRING,
} from "@metriport/carequality-sdk/common/util";
import { Config } from "../../shared/config";
import { CQOrgDetailsWithUrls } from "./shared";
import { Organization, Endpoint } from "@medplum/fhirtypes";

const metriportOid = Config.getSystemRootOID();

export function getOrganizationFhirTemplate(orgDetails: CQOrgDetailsWithUrls): Organization {
  const { oid, role, urlXCPD, urlDQ, urlDR } = orgDetails;
  const urnOid = "urn:oid:" + oid;
  const endpoints: Endpoint[] = [];
  if (role === "Implementer") {
    if (!urlXCPD) throw new Error("XCPD URL is required for Implementer role");
    endpoints.push(getEndpoint(urnOid, XCPD_STRING, urlXCPD));
    if (!urlDQ) throw new Error("DQ URL is required for Implementer role");
    endpoints.push(getEndpoint(urnOid, XCA_DQ_STRING, urlDQ));
    if (!urlDR) throw new Error("DR URL is required for Implementer role");
    endpoints.push(getEndpoint(urnOid, XCA_DR_STRING, urlDR));
  }
  const org = getOrganization(urnOid, orgDetails, endpoints);
  return org;
}

function getOrganization(
  urnOid: string,
  orgDetails: CQOrgDetailsWithUrls,
  endpoints: Endpoint[]
): Organization {
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
    state,
    postalCode,
    lat,
    lon,
    parentOrgOid,
  } = orgDetails;
  const org: Organization = {
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
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/contactentity-type",
              code: "OPERATIONS",
            },
          ],
        },
        name: {
          use: "official",
          text: contactName,
        },
        telecom: [
          {
            system: "phone",
            value: phone,
          },
          {
            system: "email",
            value: email,
          },
        ],
        address: {
          use: "work",
          type: "both",
          line: [addressLine1],
          city,
          postalCode,
          country: "USA",
        },
      },
    ],
    extension: [
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
        url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/Domains",
        valueCoding: {
          system: "https://sequoiaproject.org/fhir/sphd/CodeSystem/Domains",
          code: "CQ",
        },
      },
    ],
    address: [
      {
        use: "work",
        type: "both",
        line: [addressLine1],
        city,
        state,
        postalCode,
        country: "USA",
        extension: [
          {
            url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/OrgLocation",
            valueReference: {
              reference: "#location-1",
            },
          },
        ],
      },
    ],
    partOf: {
      reference: `Organization/${parentOrgOid ?? metriportOid}`,
      type: "Organization",
    },
    endpoint: endpoints.map((_, index) => {
      return {
        reference: `#endpoint-${index + 1}`,
        type: "Endpoint",
      };
    }),
    contained: [
      {
        id: "location-1",
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
          id: `endpoint-${index + 1}`,
          ...endpoint,
        };
      }),
    ],
  };
  return org;
}

function getEndpoint(urnOid: string, urlType: ChannelUrl, url: string): Endpoint {
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
        url: "https://sequoiaproject.org/fhir/sphd/StructureDefinition/Transaction",
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

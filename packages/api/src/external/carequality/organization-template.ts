import {
  ChannelUrl,
  XCA_DQ_STRING,
  XCA_DR_STRING,
  XCPD_STRING,
} from "@metriport/carequality-sdk/common/util";
import { Config } from "../../shared/config";
import { CQOrgDetailsWithUrls } from "./shared";

const metriportOid = Config.getSystemRootOID();

export function buildXmlStringFromTemplate(orgDetails: CQOrgDetailsWithUrls) {
  const {
    name,
    oid,
    addressLine1,
    city,
    state,
    postalCode,
    lat,
    lon,
    urlXCPD,
    urlDQ,
    urlDR,
    contactName,
    phone,
    email,
    role,
    hostOrgOID,
  } = orgDetails;

  const urnOid = "urn:oid:" + oid;

  const endpoints =
    role === "Implementer"
      ? getEndpoint(urnOid, XCPD_STRING, urlXCPD) +
        getEndpoint(urnOid, XCA_DQ_STRING, urlDQ) +
        getEndpoint(urnOid, XCA_DR_STRING, urlDR)
      : "";

  return `<Organization>
    <identifier>
        <use value="official"/>
        <system value="http://www.hl7.org/oid/"/>
        <value value="${urnOid}"/>
    </identifier>
    <active value="true"/>
    <name value="${name}"/>
    <type>
        <coding>
            <system value="http://hl7.org/fhir/organization-type"/>
            <code value="${role}"/> 
        </coding>
    </type>
    <contact>
        <purpose value="Operations"/>
        <name>
            <use value="official"/>
            <text value="${contactName}"/>
        </name>
        <telecom>
            <system value="email"/>
            <value value="${email}"/>
            <use value="work"/>
        </telecom>
        <telecom>
            <system value="phone"/>
            <value value="${phone}"/>
            <use value="work"/>
        </telecom>
        <address>
            <use value="work"/>
            <type value="both"/>
            <line value="${addressLine1}"/>
            <city value="${city}"/>
            <postalCode value="${postalCode}"/>
            <country value="USA"/>
        </address>
    </contact>
    <address>
        <use value="work"/>
        <type value="both"/>
        <line value="${addressLine1}"/>
        <city value="${city}"/>
        <state value="${state}"/>
        <postalCode value="${postalCode}"/>
        <country value="USA"/>
        <extension url="OrgPosition">
            <valueCodeableConcept>
                <coding>
                    <system value="https://sequoiaproject.org/StructureDefinition/Address/Position/1.0.0"/>
                    <value>
                        <position>
                            <longitude value="${lon}"/>
                            <latitude value="${lat}"/>
                        </position>
                    </value>
                </coding>
            </valueCodeableConcept>
        </extension>
    </address>
    ${getPartOf(hostOrgOID)}
    ${endpoints}
    <managingOrg>
        <reference value="org.sequoiaproject.fhir.stu3/Organization/${name}">
    </managingOrg>
</Organization>`;
}

function getEndpoint(oid: string, urlType: ChannelUrl, url?: string) {
  const channelType = urlType === XCPD_STRING ? "ihe-xcpd" : "ihe-xca";
  const channelName =
    urlType === XCPD_STRING
      ? "Patient Discovery"
      : urlType === XCA_DQ_STRING
      ? "Query for Documents"
      : "Retrieve Documents";

  return `<contained>
    <Endpoint>
        <!--Home Community ID-->
        <identifier>
            <use value="official"/>
            <type value="HCID"/>
            <system value="http://www.hl7.org/oid/"/>
            <value value="${oid}"/>
        </identifier>
        <!--Assigning Authority ID-->
        <identifier>
            <use value="official"/>
            <type value="AAID"/>
            <system value="http://www.hl7.org/oid/"/>
        </identifier>
        <connectionType>
            <system value="http://hl7.org/fhir/subscription-channel-type"/>
            <code value="${channelType}"/>
        </connectionType>
        <name value="${channelName}"/>
        <managingOrganization/>
        <address value="${url}"/>
        <payloadMimeType value="application/json"/>
        <payloadType>
            <coding>
                <system value="urn:oid:1.3.6.1.4.1.19376.1.2.3"/>
            </coding>
        </payloadType>
        <extension url="https://sequoiaproject.org/StructureDefinition/Endpoint/main/1.0.0">
            <extension url="Transaction">
                <valueString value="${urlType}"/>
            </extension>
            <extension url="Actor">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/Actor/1.0.0"/>
                        <value value="Responding Gateway"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <extension url="Version">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/Version/1.0.0"/>
                        <value value="2.0"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <extension url="UseCases">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/UseCases/1.0.0"/>
                        <value value="QueryBasedDocumentExchange"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <extension url="PurposesOfUse">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/PurposesOfUse/1.0.0"/>
                        <value value="Treatment"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <extension url="Roles">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/Roles/1.0.0"/>
                        <value value="All"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <extension url="IPA">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/IPA/1.0.0"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
        </extension>
    </Endpoint>
</contained>
`;
}

function getPartOf(hostOrgOid?: string): string {
  const oid = hostOrgOid ?? metriportOid;
  return `<partOf>
        <identifier>
            <use value="official"/>
            <type value="HCID"/>
            <system value="http://www.hl7.org/oid/"/>
            <value value="urn:oid:${oid}"/>
        </identifier>
    </partOf>`;
}

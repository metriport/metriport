import { XCPD_STRING, XCA_DQ_STRING, XCA_DR_STRING } from "@metriport/carequality-sdk/common/util";

export function buildOrganizationFromTemplate({
  orgName,
  orgOID,
  addressLine1,
  city,
  state,
  postalCode,
  longitude,
  latitude,
  urlXCPD,
  urlDQ,
  urlDR,
  contactName,
  phone,
  email,
}: {
  orgName: string;
  orgOID: string;
  addressLine1: string;
  city: string;
  state: string;
  postalCode: string;
  longitude: string;
  latitude: string;
  urlXCPD: string;
  urlDQ: string;
  urlDR: string;
  contactName: string;
  phone: string;
  email: string;
}) {
  const oid = "urn:oid:" + orgOID;
  const endpointXCPD = getEndpoint(oid, urlXCPD, XCPD_STRING, "ihe-xcpd", "Patient Discovery");
  const endpointDQ = getEndpoint(oid, urlDQ, XCA_DQ_STRING, "ihe-xca", "Query for Documents");
  const endpointDR = getEndpoint(oid, urlDR, XCA_DR_STRING, "ihe-xca", "Retrieve Documents");

  return `
  <Organization>
<!--This is the XCA/XCPD HomeCommunityID OID in URN format-->
<identifier>
    <use value="official"/>
    <system value="http://www.hl7.org/oid/"/>
    <value value="${oid}"/>
</identifier>
<active value="true"/>
<name value="${orgName}"/>
<type>
    <coding>
        <system value="http://hl7.org/fhir/organization-type"/>
        <code value="Implementer"/> 
    </coding>
</type>
<!--The contact object is repeated for each person listed in the directory-->
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
    <!--General address for this specific person-->
    <address>
        <use value="work"/>
        <type value="both"/>
        <line value="${addressLine1}"/>
        <city value="${city}"/>
        <postalCode value="${postalCode}"/>
        <country value="USA"/>
    </address>
</contact>
<!--General organizational physical and mailing address-->
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
                        <longitude value="${longitude}"/>
                        <latitude value="${latitude}"/>
                    </position>
                </value>
            </coding>
        </valueCodeableConcept>
    </extension>
</address>
<!--If this is a Carequality Connection, then the partOf object points to the Carequality Implementer-->
<!--If this is a eHealth Exchange Sub-Participant, then the partOf object points to the eHealth Exchange Participant-->
<!--If this is a lower-level organization, then the partOf object points to the immediate parent organization-->
<!--If this is a top-level organization, then the partOf object is not specified-->
<!--The Endpoints are represented as contained resources and are repeated as needed-->
${endpointXCPD}
${endpointDQ}
${endpointDR}
</Organization>`;
}

function getEndpoint(
  oid: string,
  url: string,
  urlType: string,
  channelType: string,
  channelName: string
) {
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
            <!--Is this gateway an initiator or responder actor-->
            <extension url="Actor">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/Actor/1.0.0"/>
                        <value value="Responding Gateway"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <!--Version of the service as per the eHealth Exchange specifications-->
            <extension url="Version">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/Version/1.0.0"/>
                        <value value="2.0"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <!--Initiative specific list of use cases supported-->
            <extension url="UseCases">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/UseCases/1.0.0"/>
                        <value value="QueryBasedDocumentExchange"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <!--PurposesOfUse Value Set for SAML header and/or access control-->
            <extension url="PurposesOfUse">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/PurposesOfUse/1.0.0"/>
                        <value value="Treatment"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <!--Roles Value Set for SAML header and/or access control-->
            <extension url="Roles">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/Roles/1.0.0"/>
                        <value value="All"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
            <!--IPAs of gateway, may repeat-->
            <extension url="IPA">
                <valueCodeableConcept>
                    <coding>
                        <system value="https://sequoiaproject.org/StructureDefinition/Endpoint/IPA/1.0.0"/>
                    </coding>
                </valueCodeableConcept>
            </extension>
        </extension>
    </Endpoint>
</contained>`;
}

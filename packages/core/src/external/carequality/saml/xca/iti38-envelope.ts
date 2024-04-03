import { XMLBuilder } from "fast-xml-parser";
import { createSecurityHeader } from "../security/security-header";
import { signTimestamp, signEnvelope } from "../security/sign";
import { insertKeyInfo } from "../security/insert-key-info";
import { verifyXmlSignatures } from "../security/verify";
import * as uuid from "uuid";

const action = "urn:ihe:iti:2007:CrossGatewayQuery";
const reply_to = "http://www.w3.org/2005/08/addressing/anonymous";
const find_document_id = "14d4debf-8f97-4251-9a74-a90016b0af0d";

const metriport_organization = "Metriport";
// const metriport_home_community_id = "2.16.840.1.113883.3.9621";

export const namespaces = {
  soap: "http://www.w3.org/2003/05/soap-envelope",
  wsa: "http://www.w3.org/2005/08/addressing",
  urn: "urn:oasis:names:tc:ebxml-regrep:xsd:query:3.0",
  urn2: "urn:oasis:names:tc:ebxml-regrep:xsd:rim:3.0",
};

type DQBodyData = {
  id: string;
  gateway: {
    homeCommunityId: string;
    url: string;
  };
  externalGatewayPatient: {
    id: string;
    system: string;
  };
  classCode: Array<{
    code: string;
    system: string;
  }>;
  practiceSettingCode: Array<{
    code: string;
    system: string;
  }>;
  facilityTypeCode: Array<{
    code: string;
    system: string;
  }>;
  serviceDate: {
    dateFrom: string;
    dateTo: string;
  };
  documentCreationDate: {
    dateFrom: string;
    dateTo: string;
  };
  samlAttributes: {
    subjectRole: {
      display: string;
    };
    organization: string;
    organizationId: string;
    homeCommunityId: string;
    purposeOfUse: string;
  };
};

export function createSoapEnvelope(bodyData: DQBodyData, x509CertPem: string): string {
  const message_id = `urn:uuid:${bodyData.id}`;
  const gateway_home_community_id = bodyData.gateway.homeCommunityId;
  const to_url = bodyData.gateway.url;
  const external_gateway_patient_id = bodyData.externalGatewayPatient.id;
  const external_gateway_patient_system = bodyData.externalGatewayPatient.system;
  const class_code = bodyData.classCode[0];
  const practice_setting_code = bodyData.practiceSettingCode[0];
  const facility_type_code = bodyData.facilityTypeCode[0];
  const service_date = bodyData.serviceDate;
  const document_creation_date = bodyData.documentCreationDate;

  const subject_role = bodyData.samlAttributes.subjectRole.display;
  //   const organization = bodyData.samlAttributes.organization;
  //   const organization_id = bodyData.samlAttributes.organizationId;
  const home_community_id = bodyData.samlAttributes.homeCommunityId;
  const purpose_of_use = bodyData.samlAttributes.purposeOfUse;

  const service_date_from = service_date.dateFrom.replace(/[-:T]/g, "").split(".")[0];
  const service_date_to = service_date.dateTo.replace(/[-:T]/g, "").split(".")[0];
  const document_creation_date_from = document_creation_date.dateFrom
    .replace(/[-:T]/g, "")
    .split(".")[0];
  const document_creation_date_to = document_creation_date.dateTo
    .replace(/[-:T]/g, "")
    .split(".")[0];

  const created_timestamp = new Date().toISOString();
  const expires_timestamp = new Date(
    new Date(created_timestamp).getTime() + 60 * 60 * 1000
  ).toISOString();

  const securityHeader = createSecurityHeader(
    x509CertPem,
    created_timestamp,
    expires_timestamp,
    to_url,
    subject_role,
    metriport_organization,
    home_community_id,
    purpose_of_use
  );

  const soapBody = {
    "soap:Body": {
      "urn:AdhocQueryRequest": {
        "@_federated": "false",
        "@_id": message_id,
        "@_maxResults": "-1",
        "@_startIndex": "0",
        "urn:ResponseOption": {
          // "@_returnComposedObjects": "true",
          "@_returnType": "LeafClass",
        },
        "urn2:AdhocQuery": {
          "@_home": gateway_home_community_id,
          "@_id": `urn:uuid:${find_document_id}`,
          "@_lid": "urn:oasis:names:tc:ebxml-regrep:query:AdhocQueryRequest",
          "@_objectType": namespaces.urn2,
          "@_status": namespaces.urn2,
          "urn2:Slot": [
            {
              "@_name": "$XDSDocumentEntryPatientId",
              "@_slotType": "rim:StringValueType",
              "urn2:ValueList": {
                "urn2:Value": `'${external_gateway_patient_id}^^^&${external_gateway_patient_system}&ISO'`,
              },
            },
            {
              "@_name": "$XDSDocumentEntryStatus",
              "urn2:ValueList": {
                "urn2:Value": "('urn:oasis:names:tc:ebxml-regrep:StatusType:Approved')",
              },
            },
            {
              "@_name": "$XDSDocumentEntryClassCode",
              "urn2:ValueList": {
                "urn2:Value": `('${class_code?.code}^^${class_code?.system}')`,
              },
            },
            {
              "@_name": "$XDSDocumentEntryPracticeSettingCode",
              "urn2:ValueList": {
                "urn2:Value": `('${practice_setting_code?.code}^^${practice_setting_code?.system}')`,
              },
            },
            {
              "@_name": "$XDSDocumentEntryHealthcareFacilityTypeCode",
              "urn2:ValueList": {
                "urn2:Value": `('${facility_type_code?.code}^^${facility_type_code?.system}')`,
              },
            },
            {
              "@_name": "$XDSDocumentEntryServiceStartTimeFrom",
              "urn2:ValueList": {
                "urn2:Value": service_date_from,
              },
            },
            {
              "@_name": "$XDSDocumentEntryServiceStartTimeTo",
              "urn2:ValueList": {
                "urn2:Value": service_date_to,
              },
            },
            {
              "@_name": "$XDSDocumentEntryCreationTimeFrom",
              "urn2:ValueList": {
                "urn2:Value": document_creation_date_from,
              },
            },
            {
              "@_name": "$XDSDocumentEntryCreationTimeTo",
              "urn2:ValueList": {
                "urn2:Value": document_creation_date_to,
              },
            },
            {
              "@_name": "$XDSDocumentEntryType",
              "urn2:ValueList": {
                "urn2:Value": [`('urn:uuid:${uuid.v4()}','urn:uuid:${uuid.v4()}')`],
              },
            },
          ],
        },
      },
    },
  };

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "@_xmlns:urn": namespaces.urn,
      "@_xmlns:urn2": namespaces.urn2,
      "soap:Header": {
        "@_xmlns:wsa": namespaces.wsa,
        "wsa:To": {
          "#text": to_url,
          "@_mustUnderstand": "1",
        },
        "wsa:Action": {
          "#text": action,
          "@_mustUnderstand": "1",
        },
        "wsa:MessageID": message_id,
        "wsa:ReplyTo": {
          "wsa:Address": reply_to,
        },
        ...securityHeader,
      },
      ...soapBody,
    },
  };

  const options = {
    format: false,
    ignoreAttributes: false,
    suppressEmptyNode: true,
    declaration: {
      include: true,
      encoding: "UTF-8",
      version: "1.0",
    },
  };

  const builder = new XMLBuilder(options);
  const xmlContent = builder.build(soapEnvelope);
  return xmlContent;
}

export async function createAndSignDQRequest(
  bodyData: DQBodyData,
  x509CertPem: string,
  privateKey: string
): Promise<string> {
  const xmlString = createSoapEnvelope(bodyData, x509CertPem);
  const signedTimestamp = signTimestamp(xmlString, privateKey);
  const signedTimestampAndEnvelope = signEnvelope(signedTimestamp.getSignedXml(), privateKey);
  const insertedKeyInfo = insertKeyInfo(signedTimestampAndEnvelope.getSignedXml(), x509CertPem);
  const verified = await verifyXmlSignatures(insertedKeyInfo, x509CertPem);
  if (!verified) {
    throw new Error("Signature verification failed.");
  }
  return insertedKeyInfo;
}

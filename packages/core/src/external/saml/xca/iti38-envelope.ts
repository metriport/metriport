import * as uuid from "uuid";
import dayjs from "dayjs";
import { XMLBuilder } from "fast-xml-parser";
import { createSecurityHeader } from "../security/security-header";
import { signFullSaml } from "../security/sign";
import { namespaces } from "../namespaces";
import {
  ORGANIZATION_NAME_DEFAULT as metriport_organization,
  reply_to,
} from "../../carequality/shared";

const action = "urn:ihe:iti:2007:CrossGatewayQuery";
const find_document_id = "14d4debf-8f97-4251-9a74-a90016b0af0d";

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

function createSoapBody(bodyData: DQBodyData): object {
  const message_id = `urn:uuid:${bodyData.id}`;
  const class_code = bodyData.classCode?.[0];
  const practice_setting_code = bodyData.practiceSettingCode?.[0];
  const facility_type_code = bodyData.facilityTypeCode?.[0];
  const service_date_from = dayjs(bodyData.serviceDate.dateFrom).format("YYYYMMDDHHmmss");
  const service_date_to = dayjs(bodyData.serviceDate.dateTo).format("YYYYMMDDHHmmss");
  const document_creation_date_from = dayjs(bodyData.documentCreationDate.dateFrom).format(
    "YYYYMMDDHHmmss"
  );
  const document_creation_date_to = dayjs(bodyData.documentCreationDate.dateTo).format(
    "YYYYMMDDHHmmss"
  );
  const gateway_home_community_id = bodyData.gateway.homeCommunityId;
  const external_gateway_patient_id = bodyData.externalGatewayPatient.id;
  const external_gateway_patient_system = bodyData.externalGatewayPatient.system;

  const soapBody = {
    "soap:Body": {
      "urn:AdhocQueryRequest": {
        "@_federated": "false",
        "@_id": message_id,
        "@_maxResults": "-1",
        "@_startIndex": "0",
        "urn:ResponseOption": {
          //TODO figure out why we cant insert boolean strings without xml getting messed uo i.e. "@_returnComposedObjects": "true",
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
  return soapBody;
}

export function createSoapEnvelope({
  bodyData,
  publicCert,
}: {
  bodyData: DQBodyData;
  publicCert: string;
}): string {
  const message_id = `urn:uuid:${bodyData.id}`;
  const to_url = bodyData.gateway.url;

  const subject_role = bodyData.samlAttributes.subjectRole.display;
  const home_community_id = bodyData.samlAttributes.homeCommunityId;
  const purpose_of_use = bodyData.samlAttributes.purposeOfUse;

  const created_timestamp = dayjs().toISOString();
  const expires_timestamp = dayjs(created_timestamp).add(1, "hour").toISOString();

  const securityHeader = createSecurityHeader({
    publicCert,
    created_timestamp,
    expires_timestamp,
    to_url,
    subject_role,
    metriport_organization,
    home_community_id,
    purpose_of_use,
  });

  const soapBody = createSoapBody(bodyData);

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "@_xmlns:wsa": namespaces.wsa,
      "@_xmlns:urn": namespaces.urn,
      "@_xmlns:urn2": namespaces.urn2,
      "soap:Header": {
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

export function createAndSignDQRequest(
  bodyData: DQBodyData,
  publicCert: string,
  privateKey: string
): string {
  const xmlString = createSoapEnvelope({ bodyData, publicCert });
  const fullySignedSaml = signFullSaml({ xmlString, publicCert, privateKey });
  return fullySignedSaml;
}

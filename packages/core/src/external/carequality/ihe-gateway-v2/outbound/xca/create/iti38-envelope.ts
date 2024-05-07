import dayjs from "dayjs";
import { XMLBuilder } from "fast-xml-parser";
import { createSecurityHeader } from "../../../saml/security/security-header";
import { signFullSaml } from "../../../saml/security/sign";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { namespaces, expiresIn } from "../../../constants";
import { ORGANIZATION_NAME_DEFAULT as metriportOrganization, replyTo } from "../../../../shared";
import { OutboundDocumentQueryReq, XCAGateway } from "@metriport/ihe-gateway-sdk";
import { wrapIdInUrnUuid } from "../../../../../../util/urn";

const action = "urn:ihe:iti:2007:CrossGatewayQuery";
const findDocumentId = "14d4debf-8f97-4251-9a74-a90016b0af0d";

const stableDocumentType = "7edca82f-054d-47f2-a032-9b2a5b5186c1";
const onDemandDocumentType = "34268e47-fdf5-41a6-ba33-82133c465248";

export type BulkSignedDQ = {
  gateway: XCAGateway;
  signedRequest: string;
  outboundRequest: OutboundDocumentQueryReq;
};

function createSoapBody(bodyData: OutboundDocumentQueryReq): object {
  if (!bodyData.gateway) {
    throw new Error("Gateway must be provided");
  }
  const messageId = wrapIdInUrnUuid(bodyData.id);
  const classCode = bodyData.classCode;
  const practiceSettingCode = bodyData.practiceSettingCode;
  const facilityTypeCode = bodyData.facilityTypeCode;
  const serviceDateFrom = bodyData.serviceDate?.dateFrom
    ? dayjs(bodyData.serviceDate.dateFrom).format("YYYYMMDDHHmmss")
    : undefined;
  const serviceDateTo = bodyData.serviceDate?.dateTo
    ? dayjs(bodyData.serviceDate.dateTo).format("YYYYMMDDHHmmss")
    : undefined;
  const documentCreationDateFrom = bodyData.documentCreationDate?.dateFrom
    ? dayjs(bodyData.documentCreationDate.dateFrom).format("YYYYMMDDHHmmss")
    : undefined;
  const documentCreationDateTo = bodyData.documentCreationDate?.dateTo
    ? dayjs(bodyData.documentCreationDate.dateTo).format("YYYYMMDDHHmmss")
    : undefined;
  const gatewayHomeCommunityId = bodyData.gateway.homeCommunityId;
  const externalGatewayPatientId = bodyData.externalGatewayPatient.id;
  const externalGatewayPatientSystem = bodyData.externalGatewayPatient.system;

  const soapBody = {
    "soap:Body": {
      "urn:AdhocQueryRequest": {
        "@_federated": "false",
        "@_id": messageId,
        "@_maxResults": "-1",
        "@_startIndex": "0",
        "urn:ResponseOption": {
          "@_returnType": "LeafClass",
        },
        "urn2:AdhocQuery": {
          "@_home": gatewayHomeCommunityId,
          "@_id": wrapIdInUrnUuid(findDocumentId),
          "@_lid": "urn:oasis:names:tc:ebxml-regrep:query:AdhocQueryRequest",
          "@_objectType": namespaces.urn2,
          "@_status": namespaces.urn2,
          "urn2:Slot": [
            {
              "@_name": "$XDSDocumentEntryPatientId",
              "@_slotType": "rim:StringValueType",
              "urn2:ValueList": {
                "urn2:Value": `'${externalGatewayPatientId}^^^&${externalGatewayPatientSystem}&ISO'`,
              },
            },
            {
              "@_name": "$XDSDocumentEntryStatus",
              "urn2:ValueList": {
                "urn2:Value": "('urn:oasis:names:tc:ebxml-regrep:StatusType:Approved')",
              },
            },
            ...(classCode?.code && classCode?.system
              ? [
                  {
                    "@_name": "$XDSDocumentEntryClassCode",
                    "urn2:ValueList": {
                      "urn2:Value": `('${classCode.code}^^${classCode.system}')`,
                    },
                  },
                ]
              : []),
            ...(practiceSettingCode?.code && practiceSettingCode?.system
              ? [
                  {
                    "@_name": "$XDSDocumentEntryPracticeSettingCode",
                    "urn2:ValueList": {
                      "urn2:Value": `('${practiceSettingCode.code}^^${practiceSettingCode.system}')`,
                    },
                  },
                ]
              : []),
            ...(facilityTypeCode?.code && facilityTypeCode?.system
              ? [
                  {
                    "@_name": "$XDSDocumentEntryHealthcareFacilityTypeCode",
                    "urn2:ValueList": {
                      "urn2:Value": `('${facilityTypeCode.code}^^${facilityTypeCode.system}')`,
                    },
                  },
                ]
              : []),
            ...(serviceDateFrom
              ? [
                  {
                    "@_name": "$XDSDocumentEntryServiceStartTimeFrom",
                    "urn2:ValueList": {
                      "urn2:Value": serviceDateFrom,
                    },
                  },
                ]
              : []),
            ...(serviceDateTo
              ? [
                  {
                    "@_name": "$XDSDocumentEntryServiceStartTimeTo",
                    "urn2:ValueList": {
                      "urn2:Value": serviceDateTo,
                    },
                  },
                ]
              : []),
            ...(documentCreationDateFrom
              ? [
                  {
                    "@_name": "$XDSDocumentEntryCreationTimeFrom",
                    "urn2:ValueList": {
                      "urn2:Value": documentCreationDateFrom,
                    },
                  },
                ]
              : []),
            ...(documentCreationDateTo
              ? [
                  {
                    "@_name": "$XDSDocumentEntryCreationTimeTo",
                    "urn2:ValueList": {
                      "urn2:Value": documentCreationDateTo,
                    },
                  },
                ]
              : []),
            {
              "@_name": "$XDSDocumentEntryType",
              "urn2:ValueList": {
                "urn2:Value": [
                  `(${wrapIdInUrnUuid(stableDocumentType)},${wrapIdInUrnUuid(
                    onDemandDocumentType
                  )})`,
                ],
              },
            },
          ],
        },
      },
    },
  };
  return soapBody;
}

export function createITI38SoapEnvelope({
  bodyData,
  publicCert,
}: {
  bodyData: OutboundDocumentQueryReq;
  publicCert: string;
}): string {
  const messageId = wrapIdInUrnUuid(bodyData.id);
  const toUrl = bodyData.gateway.url;

  const subjectRole = bodyData.samlAttributes.subjectRole.display;
  const homeCommunityId = bodyData.samlAttributes.homeCommunityId;
  const purposeOfUse = bodyData.samlAttributes.purposeOfUse;

  const createdTimestamp = dayjs().toISOString();
  const expiresTimestamp = dayjs(createdTimestamp).add(expiresIn, "minute").toISOString();

  const securityHeader = createSecurityHeader({
    publicCert,
    createdTimestamp,
    expiresTimestamp,
    toUrl,
    subjectRole,
    metriportOrganization,
    homeCommunityId,
    purposeOfUse,
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
          "#text": toUrl,
          "@_mustUnderstand": "1",
        },
        "wsa:Action": {
          "#text": action,
          "@_mustUnderstand": "1",
        },
        "wsa:MessageID": messageId,
        "wsa:ReplyTo": {
          "wsa:Address": replyTo,
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
  bodyData: OutboundDocumentQueryReq,
  samlCertsAndKeys: SamlCertsAndKeys
): string {
  const xmlString = createITI38SoapEnvelope({ bodyData, publicCert: samlCertsAndKeys.publicCert });
  const fullySignedSaml = signFullSaml({ xmlString, samlCertsAndKeys });
  return fullySignedSaml;
}

export function createAndSignBulkDQRequests({
  bulkBodyData,
  samlCertsAndKeys,
}: {
  bulkBodyData: OutboundDocumentQueryReq[];
  samlCertsAndKeys: SamlCertsAndKeys;
}): BulkSignedDQ[] {
  const signedRequests: BulkSignedDQ[] = [];

  for (const bodyData of bulkBodyData) {
    const signedRequest = createAndSignDQRequest(bodyData, samlCertsAndKeys);
    signedRequests.push({ gateway: bodyData.gateway, signedRequest, outboundRequest: bodyData });
  }

  return signedRequests;
}

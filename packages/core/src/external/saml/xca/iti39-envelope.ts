import * as uuid from "uuid";
import dayjs from "dayjs";
import { XMLBuilder } from "fast-xml-parser";
import { createSecurityHeader } from "../security/security-header";
import { signFullSaml } from "../security/sign";
import { namespaces } from "../namespaces";
import {
  ORGANIZATION_NAME_DEFAULT as metriportOrganization,
  replyTo,
} from "../../carequality/shared";
import { wrapIdInUrnUuid } from "../utils";

const action = "urn:ihe:iti:2007:CrossGatewayQuery";

type DRBodyData = {
  id: string;
  gateway: {
    homeCommunityId: string;
    url: string;
  };
  documentReference: Array<{
    homeCommunityId: string;
    docUniqueId: string;
    repositoryUniqueId: string;
    metriportId: string;
  }>;
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

export function createITI39SoapEnvelope({
  bodyData,
  publicCert,
}: {
  bodyData: DRBodyData;
  publicCert: string;
}): string {
  const messageId = wrapIdInUrnUuid(bodyData.id);
  const toUrl = bodyData.gateway.url;

  const documentReferences = bodyData.documentReference.map(docRef => ({
    homeCommunityId: docRef.homeCommunityId,
    documentUniqueId: docRef.docUniqueId,
    repositoryUniqueId: docRef.repositoryUniqueId,
    metriportId: docRef.metriportId,
  }));

  const subjectRole = bodyData.samlAttributes.subjectRole.display;
  const homeCommunityId = bodyData.samlAttributes.homeCommunityId;
  const purposeOfUse = bodyData.samlAttributes.purposeOfUse;

  const createdTimestamp = dayjs().toISOString();
  const expiresTimestamp = dayjs(createdTimestamp).add(1, "hour").toISOString();

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

  const soapBody = {
    "soap:Body": {
      "urn:RetrieveDocumentSetRequest": {
        "urn:DocumentRequest": documentReferences.map(docRef => ({
          "urn:HomeCommunityId": docRef.homeCommunityId,
          "urn:RepositoryUniqueId": docRef.repositoryUniqueId,
          "urn:DocumentUniqueId": docRef.documentUniqueId,
          "urn:Id": uuid.v4(),
        })),
      },
    },
  };

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "@_xmlns:wsa": namespaces.wsa,
      "@_xmlns:urn": namespaces.urnihe,
      "soap:Header": {
        "wsa:To": {
          "@_mustUnderstand": "1",
          "#text": toUrl,
        },
        "wsa:Action": {
          "@_mustUnderstand": "1",
          "#text": action,
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

  return new XMLBuilder({ ignoreAttributes: false }).build(soapEnvelope);
}

export function createAndSignDRRequest(
  bodyData: DRBodyData,
  publicCert: string,
  privateKey: string,
  privateKeyPassword: string
): string {
  const xmlString = createITI39SoapEnvelope({ bodyData, publicCert });
  const fullySignedSaml = signFullSaml({ xmlString, publicCert, privateKey, privateKeyPassword });
  return fullySignedSaml;
}

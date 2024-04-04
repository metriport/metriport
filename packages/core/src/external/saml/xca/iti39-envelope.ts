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

export function createSoapEnvelope({
  bodyData,
  publicCert,
}: {
  bodyData: DRBodyData;
  publicCert: string;
}): string {
  const message_id = `urn:uuid:${bodyData.id}`;
  const to_url = bodyData.gateway.url;

  const document_references = bodyData.documentReference.map(doc_ref => ({
    home_community_id: doc_ref.homeCommunityId,
    document_unique_id: doc_ref.docUniqueId,
    repository_unique_id: doc_ref.repositoryUniqueId,
    metriport_id: doc_ref.metriportId,
  }));

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

  const soapBody = {
    "soap:Body": {
      "urn:RetrieveDocumentSetRequest": {
        "urn:DocumentRequest": document_references.map(doc_ref => ({
          "urn:HomeCommunityId": doc_ref.home_community_id,
          "urn:RepositoryUniqueId": doc_ref.repository_unique_id,
          "urn:DocumentUniqueId": doc_ref.document_unique_id,
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
          "#text": to_url,
        },
        "wsa:Action": {
          "@_mustUnderstand": "1",
          "#text": action,
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

  return new XMLBuilder({ ignoreAttributes: false }).build(soapEnvelope);
}

export function createAndSignDRRequest(
  bodyData: DRBodyData,
  publicCert: string,
  privateKey: string
): string {
  const xmlString = createSoapEnvelope({ bodyData, publicCert });
  const fullySignedSaml = signFullSaml({ xmlString, publicCert, privateKey });
  return fullySignedSaml;
}

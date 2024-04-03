import { XMLBuilder } from "fast-xml-parser";
import { createSecurityHeader } from "../security/security-header";
import { signTimestamp, signEnvelope } from "../security/sign";
import { insertKeyInfo } from "../security/insert-key-info";
import { verifyXmlSignatures } from "../security/verify";
import * as uuid from "uuid";

const action = "urn:ihe:iti:2007:CrossGatewayQuery";
const reply_to = "http://www.w3.org/2005/08/addressing/anonymous";
const metriport_organization = "Metriport";

export const namespaces = {
  soap: "http://www.w3.org/2003/05/soap-envelope",
  wsa: "http://www.w3.org/2005/08/addressing",
  urn: "urn:ihe:iti:xds-b:2007",
};

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

export function createSoapEnvelope(bodyData: DRBodyData, x509CertPem: string): string {
  const message_id = `urn:uuid:${bodyData.id}`;
  const to_url = bodyData.gateway.url;

  const document_references = bodyData.documentReference.map(doc_ref => ({
    home_community_id: doc_ref.homeCommunityId,
    document_unique_id: doc_ref.docUniqueId,
    repository_unique_id: doc_ref.repositoryUniqueId,
    metriport_id: doc_ref.metriportId,
  }));

  const subject_role = bodyData.samlAttributes.subjectRole.display;
  //   const organization = bodyData.samlAttributes.organization;
  //   const organization_id = bodyData.samlAttributes.organizationId;
  const home_community_id = bodyData.samlAttributes.homeCommunityId;
  const purpose_of_use = bodyData.samlAttributes.purposeOfUse;

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
      "@_xmlns:urn": namespaces.urn,
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

export async function createAndSignDRRequest(
  bodyData: DRBodyData,
  x509CertPem: string,
  privateKey: string
): Promise<string> {
  const soapEnvelope = createSoapEnvelope(bodyData, x509CertPem);
  const signedTimestamp = await signTimestamp(soapEnvelope, privateKey);
  const signedEnvelope = await signEnvelope(signedTimestamp.getSignedXml(), privateKey);
  const fullEnvelope = insertKeyInfo(signedEnvelope.getSignedXml(), x509CertPem);
  const verified = await verifyXmlSignatures(fullEnvelope, x509CertPem);
  if (!verified) {
    throw new Error("Failed to verify signed envelope");
  }

  return fullEnvelope;
}

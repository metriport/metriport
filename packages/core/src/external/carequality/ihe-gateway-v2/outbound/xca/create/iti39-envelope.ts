import dayjs from "dayjs";
import { XMLBuilder } from "fast-xml-parser";
import { createSecurityHeader } from "../../../saml/security/security-header";
import { signFullSaml } from "../../../saml/security/sign";
import { SamlCertsAndKeys } from "../../../saml/security/types";
import { namespaces, expiresIn } from "../../../constants";
import { ORGANIZATION_NAME_DEFAULT as metriportOrganization, replyTo } from "../../../../shared";
import { wrapIdInUrnUuid, wrapIdInUrnOid } from "../../../../../../util/urn";
import { OutboundDocumentRetrievalReq, XCAGateway } from "@metriport/ihe-gateway-sdk";

const action = "urn:ihe:iti:2007:CrossGatewayRetrieve";

export type BulkSignedDR = {
  gateway: XCAGateway;
  signedRequest: string;
  outboundRequest: OutboundDocumentRetrievalReq;
};

export function createITI39SoapEnvelope({
  bodyData,
  publicCert,
}: {
  bodyData: OutboundDocumentRetrievalReq;
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

  const soapBody = {
    "soap:Body": {
      "@_xmlns:xsd": namespaces.xs,
      "@_xmlns:xsi": namespaces.xsi,
      "@_xmlns:urn": namespaces.urnihe,
      "urn:RetrieveDocumentSetRequest": {
        "urn:DocumentRequest": documentReferences.map(docRef => ({
          "urn:HomeCommunityId": wrapIdInUrnOid(docRef.homeCommunityId),
          "urn:RepositoryUniqueId": wrapIdInUrnOid(docRef.repositoryUniqueId),
          "urn:DocumentUniqueId": docRef.documentUniqueId,
        })),
      },
    },
  };

  const soapEnvelope = {
    "soap:Envelope": {
      "@_xmlns:soap": namespaces.soap,
      "@_xmlns:wsa": namespaces.wsa,
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
  bodyData: OutboundDocumentRetrievalReq,
  samlCertsAndKeys: SamlCertsAndKeys
): string {
  const xmlString = createITI39SoapEnvelope({ bodyData, publicCert: samlCertsAndKeys.publicCert });
  const fullySignedSaml = signFullSaml({ xmlString, samlCertsAndKeys });
  return fullySignedSaml;
}

export function createAndSignBulkDRRequests({
  bulkBodyData,
  samlCertsAndKeys,
}: {
  bulkBodyData: OutboundDocumentRetrievalReq[];
  samlCertsAndKeys: SamlCertsAndKeys;
}): BulkSignedDR[] {
  const signedRequests: BulkSignedDR[] = [];

  for (const bodyData of bulkBodyData) {
    const signedRequest = createAndSignDRRequest(bodyData, samlCertsAndKeys);
    signedRequests.push({ gateway: bodyData.gateway, signedRequest, outboundRequest: bodyData });
  }

  return signedRequests;
}

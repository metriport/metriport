import { OutboundDocumentRetrievalReq, XCAGateway } from "@metriport/ihe-gateway-sdk";
import { METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX, replyTo, uuidv7 } from "@metriport/shared";
import { buildDayjs } from "@metriport/shared/common/date";
import { XMLBuilder } from "fast-xml-parser";
import { wrapIdInUrnOid, wrapIdInUrnUuid } from "../../../../../../util/urn";
import { expiresIn, namespaces } from "../../../constants";
import {
  doesGatewayUseSha1,
  getDocumentUniqueIdFunctionByGateway,
  getInitiatorOid,
} from "../../../gateways";
import { createSecurityHeader } from "../../../saml/security/security-header";
import { signFullSaml } from "../../../saml/security/sign";
import { SamlCertsAndKeys } from "../../../saml/security/types";

const action = "urn:ihe:iti:2007:CrossGatewayRetrieve";

export type SignedDrRequest = {
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

  const initiatorOid = getInitiatorOid(bodyData.gateway, bodyData.samlAttributes);
  const homeCommunityId = METRIPORT_HOME_COMMUNITY_ID_NO_PREFIX;
  const purposeOfUse = bodyData.samlAttributes.purposeOfUse;
  const createdTimestamp = buildDayjs().toISOString();
  const expiresTimestamp = buildDayjs(createdTimestamp).add(expiresIn, "minute").toISOString();

  const securityHeader = createSecurityHeader({
    publicCert,
    createdTimestamp,
    expiresTimestamp,
    toUrl,
    purposeOfUse,
    homeCommunityId,
    initiatorOid,
    initiatorName: bodyData.samlAttributes.organization,
  });

  const getDocumentUniqueIdFn = getDocumentUniqueIdFunctionByGateway(bodyData.gateway);
  const soapBody = {
    "soap:Body": {
      "@_xmlns:xsd": namespaces.xs,
      "@_xmlns:xsi": namespaces.xsi,
      "@_xmlns:urn": namespaces.urnihe,
      "urn:RetrieveDocumentSetRequest": {
        "urn:DocumentRequest": documentReferences.map(docRef => ({
          "urn:HomeCommunityId": wrapIdInUrnOid(docRef.homeCommunityId),
          "urn:RepositoryUniqueId": docRef.repositoryUniqueId,
          "urn:DocumentUniqueId": getDocumentUniqueIdFn(docRef.documentUniqueId),
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
          "@_soap:mustUnderstand": "1",
          "#text": toUrl,
        },
        "wsa:Action": {
          "@_soap:mustUnderstand": "1",
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
  const xmlString = createITI39SoapEnvelope({
    bodyData,
    publicCert: samlCertsAndKeys.publicCert,
  });
  const useSha1 = doesGatewayUseSha1(bodyData.gateway.homeCommunityId);
  const fullySignedSaml = signFullSaml({ xmlString, samlCertsAndKeys, useSha1 });
  return fullySignedSaml;
}

export function createAndSignBulkDRRequests({
  bulkBodyData,
  samlCertsAndKeys,
}: {
  bulkBodyData: OutboundDocumentRetrievalReq[];
  samlCertsAndKeys: SamlCertsAndKeys;
}): SignedDrRequest[] {
  const signedRequests: SignedDrRequest[] = [];

  for (const bodyData of bulkBodyData) {
    const docRefs = bodyData.documentReference;
    if (docRefs.length === 0) {
      throw new Error("OutboundDR.documentReference cannot be empty");
    }
    /**
     * Create a separate DR request for each document reference.
     * This is done to avoid the risk of external gateways throwing errors on returning large payloads,
     * when containing multiple documents in a single response.
     */
    for (const docRef of docRefs) {
      const drRequest = {
        ...bodyData,
        id: uuidv7(),
        originalRequestId: bodyData.id,
        documentReference: [docRef],
      };
      const signedRequest = createAndSignDRRequest(drRequest, samlCertsAndKeys);
      signedRequests.push({
        gateway: drRequest.gateway,
        signedRequest,
        outboundRequest: drRequest,
      });
    }
  }

  return signedRequests;
}

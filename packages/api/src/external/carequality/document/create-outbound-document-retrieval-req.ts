import { nanoid } from "nanoid";
import { Patient } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util/notifications";
import {
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import { getGatewaySpecificDocRefsPerRequest } from "@metriport/core/external/carequality/ihe-gateway-v2/gateways";
import dayjs from "dayjs";
import { chunk } from "lodash";
import { HieInitiator } from "../../hie/get-hie-initiator";
import { createPurposeOfUse, getSystemUserName } from "../shared";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

function isGWValid(gateway: { homeCommunityId: string; url: string }): boolean {
  return !!gateway.homeCommunityId && !!gateway.url;
}

export function createOutboundDocumentRetrievalReqs({
  requestId,
  patient,
  initiator,
  outboundDocumentQueryResults,
}: {
  requestId: string;
  patient: Patient;
  initiator: HieInitiator;
  outboundDocumentQueryResults: OutboundDocumentQueryResp[];
}): OutboundDocumentRetrievalReq[] {
  const now = dayjs().toISOString();
  const user = getSystemUserName(initiator.orgName);

  const patientsWithInvalidGW: string[] = [];

  const requests = outboundDocumentQueryResults.reduce(
    (acc: OutboundDocumentRetrievalReq[], documentQueryResult) => {
      const { patientId, gateway, documentReference } = documentQueryResult;

      if (!isGWValid(gateway)) {
        if (patientId) patientsWithInvalidGW.push(patientId);
        return acc;
      }

      const baseRequest: Omit<OutboundDocumentRetrievalReq, "documentReference"> = {
        id: requestId,
        cxId: patient.cxId,
        patientId: patient.id,
        timestamp: now,
        samlAttributes: {
          subjectId: user,
          subjectRole: {
            code: SUBJECT_ROLE_CODE,
            display: SUBJECT_ROLE_DISPLAY,
          },
          organization: initiator.name,
          organizationId: initiator.oid,
          homeCommunityId: initiator.oid,
          purposeOfUse: createPurposeOfUse(),
          queryGrantorOid: initiator.queryGrantorOid,
        },
        gateway: {
          homeCommunityId: gateway.homeCommunityId,
          url: gateway.url,
        },
      };

      const docRefsPerRequest = getGatewaySpecificDocRefsPerRequest(gateway);
      const docRefChunks = chunk(documentReference, docRefsPerRequest);
      const request: OutboundDocumentRetrievalReq[] = docRefChunks.map(chunk => {
        return {
          ...baseRequest,
          requestChunkId: nanoid(),
          documentReference: chunk,
        };
      });

      return [...acc, ...request];
    },
    []
  );

  if (patientsWithInvalidGW.length > 0) {
    const msg = `Gateway is not valid for patient(s)`;
    console.error(msg);

    capture.message(msg, {
      extra: {
        requestId,
        patientIds: patientsWithInvalidGW,
        cxId: patient.cxId,
      },
    });
  }

  const requestsWithDocRefs = requests.filter(request => request.documentReference.length > 0);

  return requestsWithDocRefs;
}

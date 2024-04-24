import { Organization } from "@metriport/core/domain/organization";
import { Patient } from "@metriport/core/domain/patient";
import { capture } from "@metriport/core/util/notifications";
import {
  OutboundDocumentQueryResp,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { chunk } from "lodash";
import { createPurposeOfUse, getCqInitiator, isGWValid } from "../shared";
import { DocumentReferenceWithMetriportId } from "./shared";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";
export const maxDocRefsPerDocRetrievalRequest = 5;

export async function createOutboundDocumentRetrievalReqs({
  requestId,
  patient,
  organization,
  documentReferences,
  outboundDocumentQueryResps,
}: {
  requestId: string;
  patient: Patient;
  organization: Organization;
  documentReferences: DocumentReferenceWithMetriportId[];
  outboundDocumentQueryResps: OutboundDocumentQueryResp[];
}): Promise<OutboundDocumentRetrievalReq[]> {
  const orgName = organization.data.name;
  const user = `${orgName} System User`;
  const now = dayjs().toISOString();
  const initiator = await getCqInitiator(patient);

  const getDocRefsOfGateway = (gateway: OutboundDocumentQueryResp["gateway"]) =>
    documentReferences.filter(docRef => docRef.homeCommunityId === gateway.homeCommunityId);

  const patientsWithInvalidGW: string[] = [];

  const requests = outboundDocumentQueryResps.reduce(
    (acc: OutboundDocumentRetrievalReq[], documentQueryResp) => {
      const { patientId, gateway } = documentQueryResp;

      if (!isGWValid(gateway)) {
        if (patientId) patientsWithInvalidGW.push(patientId);
        return acc;
      }

      const baseRequest: Omit<OutboundDocumentRetrievalReq, "documentReference"> = {
        id: requestId,
        cxId: patient.cxId,
        patientId: patientId,
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
        },
        gateway: {
          homeCommunityId: gateway.homeCommunityId,
          url: gateway.url,
        },
      };

      const docRefsForCurrentGateway = getDocRefsOfGateway(gateway);
      const docRefChunks = chunk(docRefsForCurrentGateway, maxDocRefsPerDocRetrievalRequest);
      const request: OutboundDocumentRetrievalReq[] = docRefChunks.map(chunk => {
        return {
          ...baseRequest,
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

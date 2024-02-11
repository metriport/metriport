import { PurposeOfUse } from "@metriport/shared";
import { capture } from "@metriport/core/util/notifications";
import {
  DocumentRetrievalReqToExternalGW,
  DocumentReference,
  DocumentQueryRespFromExternalGW,
} from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { DocumentWithMetriportId } from "./shared";
import { Organization } from "@metriport/core/domain/organization";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

export function createCQDocumentRetrievalRequests({
  requestId,
  cxId,
  organization,
  documentReferences,
  resultsOfAllExternalGWs,
}: {
  requestId: string;
  cxId: string;
  organization: Organization;
  documentReferences: DocumentWithMetriportId[];
  resultsOfAllExternalGWs: DocumentQueryRespFromExternalGW[];
}): DocumentRetrievalReqToExternalGW[] {
  const orgOid = organization.oid;
  const orgName = organization.data.name;
  const user = `${orgName} System User`;
  const now = dayjs().toISOString();

  const requests = resultsOfAllExternalGWs.reduce(
    (acc: DocumentRetrievalReqToExternalGW[], documentQueryResult) => {
      const { patientId, gateway } = documentQueryResult;

      const requestDocReferences: DocumentReference[] = documentReferences.filter(
        docRef => docRef.homeCommunityId === gateway?.homeCommunityId
      );

      const isGWValid = gateway?.homeCommunityId && gateway?.url;

      if (!isGWValid) {
        const msg = `Gateway is not valid for patient ${patientId} and homeCommunityId ${gateway?.homeCommunityId} and url ${gateway?.url}`;
        capture.message(msg, {
          extra: {
            requestId,
            patientId,
            cxId,
          },
        });

        return acc;
      }

      const request: DocumentRetrievalReqToExternalGW = {
        id: requestId,
        cxId: cxId,
        patientId: patientId,
        timestamp: now,
        samlAttributes: {
          subjectId: user,
          subjectRole: {
            code: SUBJECT_ROLE_CODE,
            display: SUBJECT_ROLE_DISPLAY,
          },
          organization: orgName,
          organizationId: orgOid,
          homeCommunityId: orgOid,
          purposeOfUse: PurposeOfUse.TREATMENT,
        },
        gateway: {
          homeCommunityId: gateway.homeCommunityId,
          url: gateway.url,
        },
        documentReference: requestDocReferences,
      };

      return [...acc, request];
    },
    []
  );

  const requestsWithDocRefs = requests.filter(request => request.documentReference.length > 0);

  return requestsWithDocRefs;
}

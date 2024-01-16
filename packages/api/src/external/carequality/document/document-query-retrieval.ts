import { PurposeOfUse } from "@metriport/shared";
import { DocumentRetrievalReqToExternalGW, DocumentReference } from "@metriport/ihe-gateway-sdk";
import dayjs from "dayjs";
import { DocumentWithMetriportId } from "./shared";
import { DocumentQueryResult } from "../document-query-result";
import { Organization } from "../../../domain/medical/organization";

const SUBJECT_ROLE_CODE = "106331006";
const SUBJECT_ROLE_DISPLAY = "Administrative AND/OR managerial worker";

export function createCQDocumentRetrievalRequests({
  requestId,
  cxId,
  organization,
  documentReferences,
  documentQueryResults,
}: {
  requestId: string;
  cxId: string;
  organization: Organization;
  documentReferences: DocumentWithMetriportId[];
  documentQueryResults: DocumentQueryResult[];
}): DocumentRetrievalReqToExternalGW[] {
  const orgOid = organization.oid;
  const orgName = organization.data.name;
  const user = `${orgName} System User`;
  const now = dayjs().toISOString();

  const requests: DocumentRetrievalReqToExternalGW[] = documentQueryResults.map(
    documentQueryResult => {
      const { patientId, gateway } = documentQueryResult.data;

      const requestDocReferences: DocumentReference[] = documentReferences.filter(
        docRef => docRef.homeCommunityId === gateway?.homeCommunityId
      );

      return {
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
          homeCommunityId: gateway?.homeCommunityId || "",
          url: gateway?.url || "",
        },
        documentReference: requestDocReferences,
      };
    }
  );

  const requestsWithDocRefs = requests.filter(request => request.documentReference.length > 0);

  return requestsWithDocRefs;
}
